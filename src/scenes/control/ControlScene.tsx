import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  LineBasicMaterial,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
} from 'three';
import { fx } from '../../core/fx';
import { useFit, useIsPortrait } from '../../core/hooks';
import { TIERS } from '../../core/perf';
import { sceneDef } from '../../core/scenes';
import { useStore } from '../../core/store';
import { clamp, prefersReducedMotion } from '../../core/util';
import { getGlowTexture } from '../../gfx/textures';

const CYAN = new Color('#27D8F2');
const AMBER = new Color('#ffb35c');
const RED = new Color('#ff6b7d');
const VIOLET = new Color('#9a82ff');
const OK = new Color('#38f0c8');

/** Cyan when cool, amber when warm, red near the cutoff */
function heatColor(out: Color, temp: number) {
  const h = clamp((temp - 50) / 48, 0, 1);
  if (h < 0.5) out.copy(CYAN).lerp(AMBER, h * 2);
  else out.copy(AMBER).lerp(RED, (h - 0.5) * 2);
  return out;
}

const RINGS = [
  { r: 1.9, tilt: [1.2, 0.2, 0], speed: 1, dir: 1 },
  { r: 2.35, tilt: [0.3, 0, 1.0], speed: 0.7, dir: -1 },
  { r: 2.8, tilt: [0.9, 0.9, 0.3], speed: 0.45, dir: 1 },
] as const;

/** A flat ring that grows and fades, used for deep scan and the beacon */
function Pulse({ active, color, period, max }: { active: boolean; color: Color; period: number; max: number }) {
  const mesh = useRef<Mesh>(null);
  const mat = useRef<MeshBasicMaterial>(null);
  const geo = useMemo(() => new TorusGeometry(1, 0.01, 4, 96), []);
  useFrame((state) => {
    const m = mesh.current;
    const mt = mat.current;
    if (!m || !mt) return;
    if (!active) {
      m.visible = false;
      return;
    }
    const ph = (state.clock.elapsedTime % period) / period;
    m.visible = true;
    m.scale.setScalar(0.5 + ph * max);
    mt.opacity = (1 - ph) * 0.5;
    mt.color.copy(color);
  });
  return (
    <mesh ref={mesh} geometry={geo} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <meshBasicMaterial ref={mat} transparent depthWrite={false} blending={AdditiveBlending} />
    </mesh>
  );
}

/**
 * Holographic ship inside a ring cluster and a shield shell. Everything reads the live ship state:
 * ring speed follows engines, the shell follows shields, colour follows reactor heat,
 * stealth dims and flickers the whole figure.
 */
export function ControlScene() {
  const tier = useStore((s) => s.tier);
  const cfg = TIERS[tier];
  const fit = useFit();
  const portrait = useIsPortrait();
  const camera = useThree((s) => s.camera);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const glow = useMemo(() => getGlowTexture(), []);

  const root = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const ringGroups = useRef<(Group | null)[]>([]);
  const glowSprite = useRef<Sprite>(null);
  const flame = useRef<Sprite>(null);
  const smooth = useRef({ temp: useStore.getState().reactorTemp, e: 0.6, sh: 0.6, stealth: 0 });

  const col = useMemo(() => new Color(), []);
  const shieldCol = useMemo(() => new Color(), []);

  const lineMat = useMemo(() => new LineBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  const ringMat = useMemo(() => new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  const beadMat = useMemo(() => new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  const glowMat = useMemo(() => new SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: AdditiveBlending }), [glow]);
  const flameMat = useMemo(() => new SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: AdditiveBlending }), [glow]);

  const shield = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: { uColor: { value: new Color('#9a82ff') }, uA: { value: 0.5 }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV; varying vec3 vP;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            vP = position;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uA; uniform float uTime;
          varying vec3 vN; varying vec3 vV; varying vec3 vP;
          void main(){
            float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
            float bands = 0.65 + 0.35 * sin(vP.y * 9.0 - uTime * 1.2);
            gl_FragColor = vec4(uColor * (0.5 + f), f * bands * uA);
          }
        `,
      }),
    [],
  );

  const geos = useMemo(() => {
    const body = new ConeGeometry(0.42, 2.4, 5);
    body.rotateZ(-Math.PI / 2);
    const wing = new BoxGeometry(0.9, 0.04, 2.3);
    wing.translate(-0.55, 0, 0);
    const fin = new BoxGeometry(0.55, 0.55, 0.04);
    fin.translate(-0.75, 0.28, 0);
    return {
      body: new EdgesGeometry(body),
      wing: new EdgesGeometry(wing),
      fin: new EdgesGeometry(fin),
      ring: tierRing(cfg.labDetail),
      bead: new BoxGeometry(0.1, 0.1, 0.1),
    };
  }, [cfg.labDetail]);

  // the camera is shared with other scenes, so put it back in front of the figure
  useEffect(() => {
    fx.baseFov = sceneDef('control').baseFov;
    camera.position.set(0, 0, 11.5);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    return () => {
      // hand the star drift to whichever scene comes next
      fx.cruise = sceneDef(useStore.getState().scene).cruise;
    };
  }, [camera]);

  useFrame((state, dt) => {
    const s = useStore.getState();
    const t = state.clock.elapsedTime;
    const sm = smooth.current;
    const k = Math.min(1, dt * 3);
    sm.temp += (s.reactorTemp - sm.temp) * k;
    sm.e += (s.power.engines / 100 - sm.e) * k;
    sm.sh += (s.power.shields / 100 - sm.sh) * k;
    sm.stealth += ((s.sw.stealth ? 1 : 0) - sm.stealth) * k;

    // star drift follows engine power, stealth slows it
    fx.cruise = (0.05 + sm.e * 0.55) * (1 - sm.stealth * 0.55);

    const flicker = reduced ? 0 : Math.sin(t * 37) * Math.sin(t * 11.3) > 0.55 ? 0.3 : 0;
    const dim = 1 - sm.stealth * (0.62 + flicker);
    heatColor(col, sm.temp);

    lineMat.color.copy(col);
    lineMat.opacity = 0.85 * dim;
    ringMat.color.copy(col);
    ringMat.opacity = (0.28 + 0.4 * sm.e) * dim;
    beadMat.color.copy(col).lerp(CYAN, 0.0);
    beadMat.opacity = 0.9 * dim;

    shieldCol.copy(VIOLET).lerp(CYAN, sm.sh * 0.6);
    shield.uniforms.uColor.value.copy(shieldCol);
    shield.uniforms.uA.value = (0.08 + 0.92 * sm.sh) * 0.85 * dim;
    shield.uniforms.uTime.value = t;

    glowMat.color.copy(col);
    glowMat.opacity = (0.2 + 0.28 * sm.e) * dim;
    if (glowSprite.current) glowSprite.current.scale.setScalar(4.2 + sm.e * 1.6 + (reduced ? 0 : Math.sin(t * 2) * 0.12));
    flameMat.color.copy(CYAN).lerp(col, 0.5);
    flameMat.opacity = (0.15 + 0.75 * sm.e) * dim;
    if (flame.current) {
      const f = 0.5 + sm.e * 1.7 + (reduced ? 0 : Math.sin(t * 19) * 0.08);
      flame.current.scale.set(f * 1.8, f * 0.8, 1);
    }

    const speed = (0.12 + sm.e * 1.1) * (reduced ? 0.15 : 1);
    ringGroups.current.forEach((g, i) => {
      if (g) g.rotation.z += dt * speed * RINGS[i].speed * RINGS[i].dir;
    });
    if (spin.current) {
      spin.current.rotation.y = t * 0.12 * (reduced ? 0.2 : 1);
      spin.current.rotation.z = Math.sin(t * 0.4) * 0.06;
    }
    if (root.current) {
      // gentle parallax with the pointer, kept small so the interface stays calm
      root.current.rotation.x += (-state.pointer.y * 0.08 - root.current.rotation.x) * Math.min(1, dt * 2);
      root.current.rotation.y += (state.pointer.x * 0.1 - root.current.rotation.y) * Math.min(1, dt * 2);
    }
  });

  const scale = (portrait ? 0.62 : 0.82) / Math.min(fit, 1.4);

  return (
    <group ref={root} position={[0, portrait ? 2.2 : 0.2, 0]} scale={scale}>
      <sprite ref={glowSprite} material={glowMat} renderOrder={0} />
      <group ref={spin}>
        <lineSegments geometry={geos.body} material={lineMat} renderOrder={2} />
        <lineSegments geometry={geos.wing} material={lineMat} renderOrder={2} />
        <lineSegments geometry={geos.fin} material={lineMat} renderOrder={2} />
        <sprite ref={flame} material={flameMat} position={[-1.35, 0, 0]} renderOrder={1} />
      </group>

      {RINGS.map((r, i) => (
        <group key={r.r} rotation={[r.tilt[0], r.tilt[1], r.tilt[2]]}>
          <group
            ref={(g) => {
              ringGroups.current[i] = g;
            }}
          >
            <mesh geometry={geos.ring} material={ringMat} scale={r.r} renderOrder={1} />
            <mesh geometry={geos.bead} material={beadMat} position={[r.r, 0, 0]} renderOrder={1} />
          </group>
        </group>
      ))}

      <mesh material={shield} renderOrder={3}>
        <sphereGeometry args={[3.25, Math.max(16, cfg.labDetail * 1.6), Math.max(12, cfg.labDetail)]} />
      </mesh>

      <DeepScanPulse />
      <BeaconPulse />
    </group>
  );
}

/** Reads the switch from the store so the pulse appears the moment it is flipped */
function DeepScanPulse() {
  const on = useStore((s) => s.sw.deepScan);
  return <Pulse active={on} color={CYAN} period={2.4} max={3.6} />;
}
function BeaconPulse() {
  const on = useStore((s) => s.sw.beacon);
  return <Pulse active={on} color={OK} period={1.4} max={2.8} />;
}

function tierRing(detail: number) {
  return new TorusGeometry(1, 0.012, 6, Math.max(48, detail * 6));
}
