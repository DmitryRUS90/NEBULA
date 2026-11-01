import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, Sprite } from 'three';
import { NOISE, SOFT_POINT } from '../../gfx/glsl';
import { TIERS } from '../../core/perf';
import { useStore } from '../../core/store';
import { mulberry32 } from '../../core/util';
import { fx } from '../../core/fx';
import { getGlowTexture } from '../../gfx/textures';

interface Props {
  /** Overall size multiplier */
  scale?: number;
  /** Opening amount 0..1, read every frame */
  open?: () => number;
  /** Extra brightness */
  intensity?: number;
}

/** The portal: event horizon disc, accretion halo, gyroscope rings, particle vortex and glow. */
export function PortalGraphics({ scale = 1, open = () => fx.portalOpen, intensity = 1 }: Props) {
  const tier = useStore((s) => s.tier);
  const cfg = TIERS[tier];
  const dpr = useThree((s) => s.viewport.dpr);
  const group = useRef<Group>(null);
  const ringA = useRef<Group>(null);
  const ringB = useRef<Group>(null);
  const glow = useMemo(() => getGlowTexture(), []);
  const oct = tier === 'lite' ? 2 : tier === 'balanced' ? 3 : 4;

  const shared = useMemo(() => ({ uTime: { value: 0 }, uOpen: { value: 0 }, uI: { value: intensity } }), [intensity]);

  const vortexGeo = useMemo(() => {
    const rand = mulberry32(11);
    const n = cfg.vortex;
    const r = new Float32Array(n);
    const a = new Float32Array(n);
    const y = new Float32Array(n);
    const seed = new Float32Array(n);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const rr = 2.5 + Math.pow(rand(), 1.5) * 7.5;
      const arm = Math.floor(rand() * 3);
      r[i] = rr;
      a[i] = (arm * Math.PI * 2) / 3 + rr * 0.5 + (rand() - 0.5) * (0.5 + rr * 0.05);
      y[i] = (rand() - 0.5) * (0.25 + rr * 0.07);
      seed[i] = rand();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aR', new BufferAttribute(r, 1));
    g.setAttribute('aA', new BufferAttribute(a, 1));
    g.setAttribute('aY', new BufferAttribute(y, 1));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    return g;
  }, [cfg.vortex]);

  const vortexUniforms = useMemo(() => ({ ...shared, uPR: { value: dpr } }), [shared, dpr]);

  useFrame((state, dt) => {
    const o = open();
    shared.uTime.value += dt;
    shared.uOpen.value = o;
    const px = state.pointer.x;
    const py = state.pointer.y;
    if (group.current) {
      group.current.rotation.y += (px * 0.22 - group.current.rotation.y) * Math.min(1, dt * 2.2);
      group.current.rotation.x += (-py * 0.14 - group.current.rotation.x) * Math.min(1, dt * 2.2);
    }
    if (ringA.current) {
      ringA.current.rotation.z += dt * (0.18 + o * 2.2);
      ringA.current.rotation.x = 1.1 + Math.sin(shared.uTime.value * 0.4) * 0.08;
    }
    if (ringB.current) {
      ringB.current.rotation.z -= dt * (0.12 + o * 1.6);
      ringB.current.rotation.y = 0.9 + Math.cos(shared.uTime.value * 0.3) * 0.08;
    }
  });

  return (
    <group ref={group} scale={scale}>
      {/* event horizon */}
      <mesh position={[0, 0, 0]} renderOrder={1}>
        <circleGeometry args={[2.15, 96]} />
        <shaderMaterial
          uniforms={shared}
          transparent
          depthWrite={false}
          defines={{ OCT: oct }}
          vertexShader={/* glsl */ `
            varying vec2 vP;
            void main(){ vP = position.xy / 2.15; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
          `}
          fragmentShader={/* glsl */ `
            uniform float uTime; uniform float uOpen; uniform float uI;
            varying vec2 vP;
            ${NOISE}
            void main(){
              float r = length(vP);
              if (r > 1.0) discard;
              float a = atan(vP.y, vP.x);
              float sw = a + 3.2 / (r + 0.25) - uTime * (0.45 + uOpen * 3.2);
              vec2 q = vec2(cos(sw), sin(sw)) * (r * 1.7);
              float n1 = fbm(vec3(q * 1.8, uTime * 0.16));
              float n2 = fbm(vec3(q * 3.7 + 4.0, uTime * 0.21));
              float lum = smoothstep(-0.25, 0.85, n1 * 0.75 + n2 * 0.5);
              vec3 deep = vec3(0.016, 0.024, 0.075);
              vec3 vio = vec3(0.45, 0.34, 0.85);
              vec3 cy = vec3(0.15, 0.85, 0.95);
              vec3 col = mix(deep, vio, lum * smoothstep(0.1, 0.95, r + lum * 0.3));
              col = mix(col, cy, pow(lum, 3.0) * smoothstep(0.4, 1.0, r));
              float rim = smoothstep(0.72, 1.0, r);
              col += cy * rim * rim * 0.95;
              col *= mix(0.04, 1.0, smoothstep(0.0, 0.6, r));
              col *= uI;
              float flood = uOpen * (1.0 - smoothstep(0.0, 0.2 + uOpen * 1.3, r));
              col = mix(col, vec3(0.88, 0.98, 1.0), flood);
              float alpha = 1.0 - smoothstep(0.93, 1.0, r);
              gl_FragColor = vec4(col, alpha);
            }
          `}
        />
      </mesh>

      {/* accretion halo */}
      <mesh position={[0, 0, -0.02]} renderOrder={0}>
        <ringGeometry args={[2.05, 3.7, 128, 1]} />
        <shaderMaterial
          uniforms={shared}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          defines={{ OCT: oct }}
          vertexShader={/* glsl */ `
            varying vec2 vP;
            void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
          `}
          fragmentShader={/* glsl */ `
            uniform float uTime; uniform float uOpen; uniform float uI;
            varying vec2 vP;
            ${NOISE}
            void main(){
              float r = length(vP);
              float t = clamp((r - 2.05) / 1.65, 0.0, 1.0);
              float a = atan(vP.y, vP.x);
              float streak = fbm(vec3(cos(a) * 2.2, sin(a) * 2.2, t * 6.0 - uTime * (0.35 + uOpen * 2.0)));
              float inten = exp(-t * 3.4) * (0.55 + 0.9 * (streak * 0.5 + 0.5));
              inten *= 1.0 - smoothstep(0.85, 1.0, t);
              vec3 cy = vec3(0.15, 0.85, 0.95);
              vec3 vio = vec3(0.5, 0.36, 0.95);
              vec3 col = mix(cy, vio, smoothstep(0.0, 0.8, t + streak * 0.2));
              col = mix(col, vec3(1.0), exp(-t * 9.0) * 0.55 + uOpen * 0.3);
              gl_FragColor = vec4(col * inten * (1.0 + uOpen * 1.2) * uI, inten);
            }
          `}
        />
      </mesh>

      {/* gyroscope rings */}
      <group ref={ringA} rotation={[1.1, 0, 0]}>
        <mesh>
          <torusGeometry args={[2.62, 0.016, 8, 220]} />
          <meshBasicMaterial color="#27D8F2" transparent opacity={0.85 * Math.min(1, intensity)} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      </group>
      <group ref={ringB} rotation={[0, 0.9, 0.4]}>
        <mesh>
          <torusGeometry args={[3.05, 0.012, 8, 220]} />
          <meshBasicMaterial color="#9a82ff" transparent opacity={0.75 * Math.min(1, intensity)} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      </group>

      {/* vortex */}
      <points geometry={vortexGeo} frustumCulled={false} renderOrder={2}>
        <shaderMaterial
          uniforms={vortexUniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          vertexShader={/* glsl */ `
            attribute float aR; attribute float aA; attribute float aY; attribute float aSeed;
            uniform float uTime; uniform float uOpen; uniform float uPR; uniform float uI;
            varying vec3 vCol; varying float vAlpha;
            void main(){
              float speed = (0.32 + uOpen * 2.6) / (0.6 + aR * 0.34);
              float ang = aA + uTime * speed;
              float rr = aR * (1.0 - uOpen * 0.5);
              vec3 p = vec3(cos(ang) * rr, sin(ang) * rr, aY);
              p.z += sin(uTime * 0.8 + aSeed * 20.0) * 0.12;
              vec4 mv = modelViewMatrix * vec4(p, 1.0);
              gl_Position = projectionMatrix * mv;
              float tw = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 40.0);
              gl_PointSize = clamp((1.2 + aSeed * 2.4) * uPR * tw * (9.0 / max(1.0, -mv.z)), 1.0, 7.0 * uPR);
              vec3 vio = vec3(0.52, 0.4, 0.98);
              vec3 cy = vec3(0.18, 0.88, 0.98);
              vCol = mix(cy, vio, smoothstep(2.6, 9.5, aR)) * (0.7 + 0.9 * tw) * uI;
              vAlpha = (1.0 - smoothstep(7.5, 10.0, aR)) * smoothstep(2.3, 3.0, aR);
            }
          `}
          fragmentShader={/* glsl */ `
            ${SOFT_POINT}
            varying vec3 vCol; varying float vAlpha;
            void main(){ float a = softPoint(); gl_FragColor = vec4(vCol, a * vAlpha); }
          `}
        />
      </points>

      {/* glow */}
      <sprite scale={[16, 16, 1]} position={[0, 0, -0.3]} renderOrder={-1}>
        <spriteMaterial map={glow} color="#6a5cf0" transparent depthWrite={false} blending={AdditiveBlending} opacity={0.42 * Math.min(1.2, intensity)} />
      </sprite>
      <sprite scale={[7.5, 7.5, 1]} position={[0, 0, 0.1]} renderOrder={3}>
        <spriteMaterial map={glow} color="#27D8F2" transparent depthWrite={false} blending={AdditiveBlending} opacity={0.35 * Math.min(1.2, intensity)} />
      </sprite>
      <PortalLight open={open} />
    </group>
  );
}

/** A bright white core that floods the view while the portal opens. */
function PortalLight({ open }: { open: () => number }) {
  const glow = useMemo(() => getGlowTexture(), []);
  const sprite = useRef<Sprite>(null);
  useFrame(() => {
    if (!sprite.current) return;
    const o = open();
    const s = 4 + o * 22;
    sprite.current.scale.set(s, s, 1);
    sprite.current.material.opacity = o * 0.95;
  });
  return (
    <sprite ref={sprite} position={[0, 0, 0.4]} renderOrder={4}>
      <spriteMaterial map={glow} color="#ffffff" transparent depthWrite={false} blending={AdditiveBlending} opacity={0} />
    </sprite>
  );
}
