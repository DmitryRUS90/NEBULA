import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { fx } from '../../core/fx';
import { useFit } from '../../core/hooks';
import { TIERS } from '../../core/perf';
import { useStore } from '../../core/store';
import { clamp, gauss, mulberry32 } from '../../core/util';
import { GALAXY_OBJECTS, omega } from '../../data/galaxy';
import { SOFT_POINT } from '../../gfx/glsl';
import { getGlowTexture } from '../../gfx/textures';
import { GalaxyObjectMesh } from './GalaxyObjectMesh';
import { galaxyApi, galaxyClock, galaxyLabels } from './galaxyApi';

const MAX_R = 31;

export function GalaxyScene() {
  const tier = useStore((s) => s.tier);
  const cfg = TIERS[tier];
  const selected = useStore((s) => s.galaxySelected);
  const fit = useFit();
  const camera = useThree((s) => s.camera);
  const dpr = useThree((s) => s.viewport.dpr);
  const controls = useRef<OrbitControlsImpl>(null);
  const groups = useRef<Record<string, Group | null>>({});
  const glow = useMemo(() => getGlowTexture(), []);
  const idleUntil = useRef(0);
  const focus = useRef({ t: 0, dist: 0 });
  const arrived = useRef(false);

  const geo = useMemo(() => {
    const rand = mulberry32(21);
    const n = cfg.galaxy;
    const pos = new Float32Array(n * 3);
    const r = new Float32Array(n);
    const a = new Float32Array(n);
    const y = new Float32Array(n);
    const seed = new Float32Array(n);
    const size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const halo = rand() < 0.14;
      const rr = halo ? 1 + rand() * (MAX_R - 2) : 0.4 + Math.pow(rand(), 1.75) * (MAX_R - 1);
      const arm = Math.floor(rand() * 4);
      const spread = (0.2 + rr * 0.018) * gauss(rand) * 1.6;
      r[i] = rr;
      a[i] = halo ? rand() * Math.PI * 2 : (arm * Math.PI) / 2 + rr * 0.24 + spread;
      y[i] = gauss(rand) * (0.12 + 1.5 * Math.exp(-rr * 0.2)) * (halo ? 1.8 : 1);
      seed[i] = rand();
      size[i] = 0.6 + Math.pow(rand(), 4) * 2.6;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aR', new BufferAttribute(r, 1));
    g.setAttribute('aA', new BufferAttribute(a, 1));
    g.setAttribute('aY', new BufferAttribute(y, 1));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    g.setAttribute('aSize', new BufferAttribute(size, 1));
    return g;
  }, [cfg.galaxy]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPR: { value: dpr } }), [dpr]);

  const home = useMemo(() => new Vector3(0, 21 * fit, 36 * fit), [fit]);

  // arrival: fly in from far out
  useEffect(() => {
    fx.baseFov = 50;
    const c = controls.current;
    camera.position.set(0, 70, 120);
    if (c) c.target.set(0, 0, 0);
    const proxy = { k: 0 };
    const from = camera.position.clone();
    if (c) c.enabled = false;
    gsap.to(proxy, {
      k: 1,
      duration: 2.4,
      ease: 'nebula',
      onUpdate: () => {
        camera.position.lerpVectors(from, home, proxy.k);
        c?.update();
      },
      onComplete: () => {
        arrived.current = true;
        if (c) c.enabled = true;
      },
    });
    return () => {
      gsap.killTweensOf(proxy);
      document.body.style.cursor = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // idle auto rotation is paused whenever the person touches the map
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const onStart = () => {
      idleUntil.current = performance.now() + 4500;
    };
    c.addEventListener('start', onStart);
    return () => c.removeEventListener('start', onStart);
  }, []);

  // camera glides to a selected object, and back out when the selection is cleared
  useEffect(() => {
    focus.current = { t: 1.8, dist: selected ? 15 * Math.min(fit, 1.4) : 38 * fit };
  }, [selected, fit]);

  useEffect(() => {
    galaxyApi.zoom = (f: number) => {
      const c = controls.current;
      if (!c) return;
      const off = camera.position.clone().sub(c.target);
      const len = clamp(off.length() * f, 10, 90 * fit);
      const to = c.target.clone().add(off.setLength(len));
      gsap.to(camera.position, { x: to.x, y: to.y, z: to.z, duration: 0.6, ease: 'nebula', overwrite: 'auto', onUpdate: () => c.update() });
    };
    galaxyApi.reset = () => {
      const c = controls.current;
      useStore.getState().galaxySelect(null);
      if (!c) return;
      focus.current = { t: 0, dist: 0 };
      gsap.to(c.target, { x: 0, y: 0, z: 0, duration: 1.2, ease: 'nebula', overwrite: 'auto' });
      gsap.to(camera.position, { x: home.x, y: home.y, z: home.z, duration: 1.4, ease: 'nebula', overwrite: 'auto', onUpdate: () => c.update() });
    };
    return () => {
      galaxyApi.zoom = () => {};
      galaxyApi.reset = () => {};
    };
  }, [camera, fit, home]);

  const tmp = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    galaxyClock.t += dt;
    uniforms.uTime.value = galaxyClock.t;
    const c = controls.current;
    if (!c || !arrived.current) return;

    c.autoRotate = !selected && performance.now() > idleUntil.current;

    const g = selected ? groups.current[selected] : null;
    if (g) {
      g.getWorldPosition(tmp);
      c.target.lerp(tmp, 1 - Math.exp(-dt * 4));
    } else if (c.target.lengthSq() > 0.001) {
      c.target.lerp(tmp.set(0, 0, 0), 1 - Math.exp(-dt * 2.5));
    }
    if (focus.current.t > 0) {
      focus.current.t -= dt;
      const off = camera.position.clone().sub(c.target);
      const len = off.length();
      const next = len + (focus.current.dist - len) * (1 - Math.exp(-dt * 2.4));
      camera.position.copy(c.target).add(off.setLength(next));
    }
  });

  // Screen positions of the overlay labels. Written straight to the DOM, same frame as the render, no React state.
  const labelWorld = useMemo(() => new Vector3(), []);
  const labelView = useMemo(() => new Vector3(), []);
  const labelLast = useRef<Record<string, { el: HTMLElement; x: number; y: number; z: number; on: boolean }>>({});
  useFrame(({ size }) => {
    camera.updateMatrixWorld();
    const zScale = -20 / (camera.far - camera.near);
    for (const o of GALAXY_OBJECTS) {
      const el = galaxyLabels[o.id];
      const g = groups.current[o.id];
      if (!el || !g) continue;
      // same anchor the old label used: just above the object
      g.getWorldPosition(labelWorld);
      labelWorld.y += o.size + 0.9;
      labelView.copy(labelWorld).applyMatrix4(camera.matrixWorldInverse);
      const on = labelView.z < 0; // in front of the camera
      // nearer labels sit above farther ones
      const z = Math.round(zScale * labelWorld.distanceTo(camera.position) - zScale * camera.far);
      labelWorld.project(camera);
      const x = (labelWorld.x * 0.5 + 0.5) * size.width;
      const y = (-labelWorld.y * 0.5 + 0.5) * size.height;
      const last = labelLast.current[o.id];
      const fresh = !last || last.el !== el;
      if (fresh || last.on !== on) el.style.visibility = on ? 'visible' : 'hidden';
      if (fresh || last.z !== z) el.style.zIndex = String(z);
      if (fresh || Math.abs(last.x - x) > 0.01 || Math.abs(last.y - y) > 0.01) {
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      }
      labelLast.current[o.id] = { el, x, y, z, on };
    }
  });

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.06}
        minDistance={9}
        maxDistance={90 * fit}
        enablePan={false}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI * 0.86}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
        autoRotateSpeed={0.35}
      />

      <points geometry={uniformsGeo(geo)} frustumCulled={false} renderOrder={2}>
        <shaderMaterial
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          vertexShader={/* glsl */ `
            attribute float aR; attribute float aA; attribute float aY; attribute float aSeed; attribute float aSize;
            uniform float uTime; uniform float uPR;
            varying vec3 vCol; varying float vA;
            void main(){
              float ang = aA + uTime * 0.35 / (6.0 + aR);
              vec3 p = vec3(cos(ang) * aR, aY, sin(ang) * aR);
              vec4 mv = modelViewMatrix * vec4(p, 1.0);
              gl_Position = projectionMatrix * mv;
              float dist = max(1.0, -mv.z);
              gl_PointSize = clamp(aSize * uPR * (62.0 / dist), 0.9 * uPR, 9.0 * uPR);
              float tw = 0.7 + 0.3 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 60.0);
              vec3 core = vec3(1.0, 0.9, 0.74);
              vec3 mid = vec3(0.6, 0.48, 1.0);
              vec3 edge = vec3(0.2, 0.82, 1.0);
              vec3 c = mix(core, mid, smoothstep(1.5, 9.0, aR));
              c = mix(c, edge, smoothstep(9.0, 28.0, aR));
              vCol = c * (0.5 + 0.7 * tw);
              vA = (0.3 + 0.7 * aSeed) * (1.0 - smoothstep(26.0, 31.0, aR));
            }
          `}
          fragmentShader={/* glsl */ `
            ${SOFT_POINT}
            varying vec3 vCol; varying float vA;
            void main(){ gl_FragColor = vec4(vCol, softPoint() * vA); }
          `}
        />
      </points>

      <sprite scale={[16, 16, 1]} renderOrder={1}>
        <spriteMaterial map={glow} color="#ffd9a8" transparent depthWrite={false} blending={AdditiveBlending} opacity={0.65} />
      </sprite>
      <sprite scale={[46, 46, 1]} renderOrder={0}>
        <spriteMaterial map={glow} color="#6a5cf0" transparent depthWrite={false} blending={AdditiveBlending} opacity={0.28} />
      </sprite>

      {GALAXY_OBJECTS.map((o, i) => (
        <GalaxyObjectMesh
          key={o.id}
          obj={o}
          index={i}
          onGroup={(id, g) => {
            groups.current[id] = g;
          }}
        />
      ))}
    </>
  );
}

// the geometry is memoized above, this keeps the JSX readable
function uniformsGeo(g: BufferGeometry) {
  return g;
}
