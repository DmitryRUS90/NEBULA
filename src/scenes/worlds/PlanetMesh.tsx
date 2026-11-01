import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh } from 'three';
import { TIERS } from '../../core/perf';
import { useStore } from '../../core/store';
import { mulberry32 } from '../../core/util';
import { NOISE, SOFT_POINT } from '../../gfx/glsl';
import type { Look } from './look';

export const PLANET_R = 1.5;

const VERT = /* glsl */ `
  varying vec3 vP; varying vec3 vWN; varying vec3 vWP;
  void main(){
    vP = position;
    vWN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWP = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

interface BodyProps {
  look: Look;
  pulse: { v: number };
}

/** The planet surface: layered noise, ridged veins, glowing spots, specular sheen and a thin rim. */
export function PlanetBody({ look, pulse }: BodyProps) {
  const tier = useStore((s) => s.tier);
  const cfg = TIERS[tier];
  const u = useMemo(
    () => ({
      uColA: { value: look.colA },
      uColB: { value: look.colB },
      uVein: { value: look.vein },
      uAtmo: { value: look.atmo },
      uLight: { value: look.light },
      uVeinAmt: { value: look.veinAmt },
      uVeinScale: { value: look.veinScale },
      uSpotAmt: { value: look.spotAmt },
      uSpotScale: { value: look.spotScale },
      uGloss: { value: look.gloss },
      uHot: { value: look.hot },
      uPow: { value: look.atmoPow },
      uAmt: { value: look.atmoAmt },
      uPulse: { value: 0 },
      uTime: { value: 0 },
    }),
    [look],
  );

  useFrame((_, dt) => {
    u.uTime.value += dt;
    u.uVeinAmt.value = look.veinAmt;
    u.uVeinScale.value = look.veinScale;
    u.uSpotAmt.value = look.spotAmt;
    u.uSpotScale.value = look.spotScale;
    u.uGloss.value = look.gloss;
    u.uHot.value = look.hot;
    u.uPow.value = look.atmoPow;
    u.uAmt.value = look.atmoAmt;
    u.uPulse.value = pulse.v;
  });

  return (
    <mesh key={cfg.planetOct}>
      <sphereGeometry args={[PLANET_R, cfg.planetSeg, Math.round(cfg.planetSeg * 0.75)]} />
      <shaderMaterial
        uniforms={u}
        defines={{ OCT: cfg.planetOct }}
        vertexShader={VERT}
        fragmentShader={/* glsl */ `
          uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uVein; uniform vec3 uAtmo; uniform vec3 uLight;
          uniform float uVeinAmt; uniform float uVeinScale; uniform float uSpotAmt; uniform float uSpotScale;
          uniform float uGloss; uniform float uHot; uniform float uPow; uniform float uAmt; uniform float uPulse; uniform float uTime;
          varying vec3 vP; varying vec3 vWN; varying vec3 vWP;
          ${NOISE}
          void main(){
            vec3 p = normalize(vP);
            vec3 N = normalize(vWN);
            vec3 L = normalize(uLight);
            vec3 V = normalize(cameraPosition - vWP);
            float n = fbm(p * 2.2) * 0.5 + 0.5;
            float n2 = fbm(p * 5.3 + 7.0) * 0.5 + 0.5;
            vec3 base = mix(uColA, uColB, smoothstep(0.25, 0.78, n * 0.7 + n2 * 0.3));
            float nd = dot(N, L);
            float lit = smoothstep(-0.18, 0.9, nd);
            vec3 col = base * (0.07 + 0.93 * lit);

            // ridged veins: cracks in ice, lava channels, root networks
            float r1 = 1.0 - abs(snoise(p * uVeinScale + 3.0));
            float r2 = 1.0 - abs(snoise(p * uVeinScale * 2.3 + 11.0));
            float vein = pow(clamp(r1, 0.0, 1.0), 9.0) * 0.95 + pow(clamp(r2, 0.0, 1.0), 12.0) * 0.5;
            float flick = 0.82 + 0.18 * sin(uTime * 2.1 + n * 12.0);
            float emit = mix(0.35 + 0.65 * lit, flick, uHot);
            vec3 veinCol = mix(uVein, vec3(1.0, 0.86, 0.45), clamp(vein * uHot * 0.7, 0.0, 1.0));
            col += veinCol * vein * uVeinAmt * emit;

            // living light that travels across the surface in slow waves
            float sp = smoothstep(0.52, 0.8, fbm(p * uSpotScale + 19.0) * 0.5 + 0.5);
            float wave = 0.5 + 0.5 * sin(uTime * 1.1 + p.y * 5.0 + p.x * 3.0 + n * 6.0);
            col += uVein * sp * (0.25 + 0.75 * wave) * uSpotAmt * (0.55 + 0.6 * (1.0 - lit));

            // sheen
            vec3 H = normalize(L + V);
            float spec = pow(max(dot(N, H), 0.0), 48.0) * uGloss * lit;
            col += vec3(0.85, 0.95, 1.0) * spec;
            float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
            col += uAtmo * fres * uGloss * 0.2 * lit;

            // thin atmospheric rim
            col += uAtmo * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uPow) * uAmt * (0.25 + 0.9 * lit) * 1.3;
            col += uVein * uPulse * 0.3 + uAtmo * uPulse * 0.1;
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

/** Soft glow around the planet, drawn from the inside of a larger sphere. */
export function Halo({ look, pulse }: BodyProps) {
  const u = useMemo(
    () => ({
      uAtmo: { value: look.atmo },
      uLight: { value: look.light },
      uPow: { value: look.atmoPow },
      uAmt: { value: look.atmoAmt },
      uPulse: { value: 0 },
    }),
    [look],
  );
  useFrame(() => {
    u.uPow.value = look.atmoPow;
    u.uAmt.value = look.atmoAmt;
    u.uPulse.value = pulse.v;
  });
  return (
    <mesh renderOrder={2}>
      <sphereGeometry args={[PLANET_R * 1.3, 48, 32]} />
      <shaderMaterial
        uniforms={u}
        side={BackSide}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        vertexShader={VERT}
        fragmentShader={/* glsl */ `
          uniform vec3 uAtmo; uniform vec3 uLight; uniform float uPow; uniform float uAmt; uniform float uPulse;
          varying vec3 vP; varying vec3 vWN; varying vec3 vWP;
          void main(){
            vec3 N = normalize(vWN);
            vec3 V = normalize(cameraPosition - vWP);
            float d = clamp(dot(-N, V), 0.0, 1.0);
            float lit = smoothstep(-0.6, 0.8, dot(N, normalize(uLight)));
            float a = pow(d, uPow + 0.6) * uAmt * (0.2 + 0.8 * lit) * 2.2 * (1.0 + uPulse * 0.9);
            gl_FragColor = vec4(uAtmo, clamp(a, 0.0, 1.0));
          }
        `}
      />
    </mesh>
  );
}

/** Banded ring, visible only while the Frozen World look is blended in. */
export function Ring({ look }: { look: Look }) {
  const mesh = useRef<Mesh>(null);
  const inner = PLANET_R * 1.32;
  const outer = PLANET_R * 2.05;
  const u = useMemo(() => ({ uRing: { value: look.ring }, uIn: { value: inner }, uOut: { value: outer } }), [look, inner, outer]);
  useFrame(() => {
    u.uRing.value = look.ring;
    if (mesh.current) mesh.current.visible = look.ring > 0.01;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
      <ringGeometry args={[inner, outer, 128, 1]} />
      <shaderMaterial
        uniforms={u}
        side={DoubleSide}
        transparent
        depthWrite={false}
        vertexShader={/* glsl */ `
          varying float vR;
          void main(){ vR = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `}
        fragmentShader={/* glsl */ `
          uniform float uRing; uniform float uIn; uniform float uOut;
          varying float vR;
          ${NOISE}
          void main(){
            float t = clamp((vR - uIn) / (uOut - uIn), 0.0, 1.0);
            float band = snoise(vec3(vR * 7.0, 1.0, 2.0)) * 0.5 + 0.5;
            band += 0.5 * (snoise(vec3(vR * 23.0, 4.0, 5.0)) * 0.5 + 0.5);
            float a = smoothstep(0.35, 1.0, band) * smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.82, 1.0, t));
            vec3 col = mix(vec3(0.5, 0.78, 0.95), vec3(0.95, 0.99, 1.0), clamp(band * 0.7, 0.0, 1.0));
            gl_FragColor = vec4(col, a * uRing * 0.78);
          }
        `}
      />
    </mesh>
  );
}

const BOX = 11;

/** Snow, embers and ash, or drifting spores, depending on the world. One draw call. */
export function Weather({ look }: { look: Look }) {
  const tier = useStore((s) => s.tier);
  const count = TIERS[tier].particles;
  const dpr = useThree((s) => s.viewport.dpr);
  const geo = useMemo(() => {
    const rand = mulberry32(5);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rand() * BOX;
      pos[i * 3 + 1] = rand() * BOX;
      pos[i * 3 + 2] = rand() * BOX;
      seed[i] = rand();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    return g;
  }, [count]);
  useEffect(() => () => geo.dispose(), [geo]);

  const u = useMemo(
    () => ({
      uVel: { value: look.wVel },
      uColor: { value: look.wColor },
      uSway: { value: look.wSway },
      uSize: { value: look.wSize },
      uAlpha: { value: look.wAlpha },
      uTime: { value: 0 },
      uPR: { value: dpr },
    }),
    [look, dpr],
  );
  useFrame((_, dt) => {
    u.uTime.value = (u.uTime.value + dt) % 4000;
    u.uSway.value = look.wSway;
    u.uSize.value = look.wSize;
    u.uAlpha.value = look.wAlpha;
  });

  return (
    <points geometry={geo} frustumCulled={false} renderOrder={4}>
      <shaderMaterial
        uniforms={u}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        vertexShader={/* glsl */ `
          attribute float aSeed;
          uniform vec3 uVel; uniform float uSway; uniform float uSize; uniform float uAlpha; uniform float uTime; uniform float uPR;
          varying float vA;
          const float B = ${BOX.toFixed(1)};
          void main(){
            vec3 q = position + uVel * uTime;
            q.x += sin(uTime * 0.6 + aSeed * 30.0) * uSway;
            q.z += cos(uTime * 0.5 + aSeed * 17.0) * uSway;
            q = mod(q, B) - B * 0.5;
            vec4 mv = modelViewMatrix * vec4(q, 1.0);
            gl_Position = projectionMatrix * mv;
            float edge = 1.0 - smoothstep(0.7, 1.0, max(max(abs(q.x), abs(q.y)), abs(q.z)) / (B * 0.5));
            gl_PointSize = clamp(uSize * (0.5 + aSeed) * uPR * (9.0 / max(1.0, -mv.z)), 1.0, 10.0 * uPR);
            vA = edge * uAlpha * (0.35 + 0.65 * aSeed);
          }
        `}
        fragmentShader={/* glsl */ `
          ${SOFT_POINT}
          uniform vec3 uColor;
          varying float vA;
          void main(){ gl_FragColor = vec4(uColor, softPoint() * vA); }
        `}
      />
    </points>
  );
}

const MOONS = [
  { r: 2.75, size: 0.17, speed: 0.13, tilt: 0.3, phase: 0.6 },
  { r: 3.5, size: 0.1, speed: 0.07, tilt: -0.45, phase: 3.4 },
];

/** Two small moons on tilted orbits, lit by the same sun as the planet. */
export function Moons({ look }: { look: Look }) {
  const tier = useStore((s) => s.tier);
  const seg = tier === 'lite' ? 12 : 24;
  const orbits = useRef<(Group | null)[]>([]);
  const u = useMemo(() => ({ uLight: { value: look.light }, uTint: { value: look.atmo } }), [look]);
  useFrame((_, dt) => {
    for (let i = 0; i < MOONS.length; i++) {
      const g = orbits.current[i];
      if (g) g.rotation.y += dt * MOONS[i].speed;
    }
  });
  return (
    <>
      {MOONS.map((m, i) => (
        <group key={i} rotation={[m.tilt, m.phase, 0]} ref={(g) => void (orbits.current[i] = g)}>
          <mesh position={[m.r, 0, 0]}>
            <sphereGeometry args={[m.size, seg, seg]} />
            <shaderMaterial
              uniforms={u}
              defines={{ OCT: 3 }}
              vertexShader={VERT}
              fragmentShader={/* glsl */ `
                uniform vec3 uLight; uniform vec3 uTint;
                varying vec3 vP; varying vec3 vWN; varying vec3 vWP;
                ${NOISE}
                void main(){
                  vec3 p = normalize(vP);
                  float n = fbm(p * 3.0 + ${(i * 7 + 1).toFixed(1)}) * 0.5 + 0.5;
                  float lit = smoothstep(-0.1, 0.85, dot(normalize(vWN), normalize(uLight)));
                  vec3 base = mix(vec3(0.3, 0.33, 0.4), uTint * 0.8, 0.3) * (0.6 + 0.6 * n);
                  gl_FragColor = vec4(base * (0.05 + 0.95 * lit), 1.0);
                }
              `}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}
