import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Vector3, type Points, type LineSegments } from 'three';
import { fx } from '../core/fx';
import { TIERS } from '../core/perf';
import { useStore } from '../core/store';
import { mulberry32 } from '../core/util';

const BOX = 240;

const WRAP = /* glsl */ `
uniform vec3 uCam; uniform vec3 uFwd; uniform float uTravel;
const float B = ${BOX.toFixed(1)};
vec3 wrapPos(vec3 p){
  vec3 q = (p - uFwd * uTravel - uCam) / B;
  return (fract(q) - 0.5) * B + uCam;
}
float edgeFade(vec3 p){
  vec3 q = fract((p - uFwd * uTravel - uCam) / B);
  vec3 f = smoothstep(0.0, 0.07, q) * (1.0 - smoothstep(0.93, 1.0, q));
  return f.x * f.y * f.z;
}
`;

/**
 * Stars live in world space and wrap around the camera. Warp stretches them into streaks
 * along the camera direction, so every scene change reads as a flight through the same sky.
 */
export function Starfield() {
  const tier = useStore((s) => s.tier);
  const count = TIERS[tier].stars;
  const dpr = useThree((s) => s.viewport.dpr);
  const points = useRef<Points>(null);
  const lines = useRef<LineSegments>(null);

  const { pointGeo, lineGeo } = useMemo(() => {
    const rand = mulberry32(7);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const seed = new Float32Array(count);
    const palette = [
      [0.85, 0.93, 1.0],
      [0.6, 0.85, 1.0],
      [0.78, 0.7, 1.0],
      [1.0, 0.92, 0.82],
    ];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rand() * BOX;
      pos[i * 3 + 1] = rand() * BOX;
      pos[i * 3 + 2] = rand() * BOX;
      const c = palette[Math.floor(rand() * palette.length)];
      col.set(c, i * 3);
      size[i] = 0.5 + Math.pow(rand(), 3) * 2.2;
      seed[i] = rand();
    }
    const pointGeo = new BufferGeometry();
    pointGeo.setAttribute('position', new BufferAttribute(pos, 3));
    pointGeo.setAttribute('aColor', new BufferAttribute(col, 3));
    pointGeo.setAttribute('aSize', new BufferAttribute(size, 1));
    pointGeo.setAttribute('aSeed', new BufferAttribute(seed, 1));

    // streaks use every second star, two vertices each
    const n = Math.floor(count / 2);
    const lpos = new Float32Array(n * 6);
    const lcol = new Float32Array(n * 6);
    const lend = new Float32Array(n * 2);
    const lseed = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const s = i * 2;
      for (let k = 0; k < 2; k++) {
        lpos.set([pos[s * 3], pos[s * 3 + 1], pos[s * 3 + 2]], (i * 2 + k) * 3);
        lcol.set([col[s * 3], col[s * 3 + 1], col[s * 3 + 2]], (i * 2 + k) * 3);
        lend[i * 2 + k] = k;
        lseed[i * 2 + k] = seed[s];
      }
    }
    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute('position', new BufferAttribute(lpos, 3));
    lineGeo.setAttribute('aColor', new BufferAttribute(lcol, 3));
    lineGeo.setAttribute('aEnd', new BufferAttribute(lend, 1));
    lineGeo.setAttribute('aSeed', new BufferAttribute(lseed, 1));
    return { pointGeo, lineGeo };
  }, [count]);

  const shared = useMemo(
    () => ({
      uCam: { value: new Vector3() },
      uFwd: { value: new Vector3(0, 0, -1) },
      uTravel: { value: 0 },
      uWarp: { value: 0 },
      uTime: { value: 0 },
    }),
    [],
  );
  const pointUniforms = useMemo(() => ({ ...shared, uPR: { value: dpr } }), [shared, dpr]);

  useFrame((state, dt) => {
    fx.travel += dt * (1.5 + fx.cruise * 30 + fx.warp * 520);
    shared.uCam.value.copy(state.camera.position);
    state.camera.getWorldDirection(shared.uFwd.value);
    shared.uTravel.value = fx.travel;
    shared.uWarp.value = fx.warp;
    shared.uTime.value += dt;
    if (lines.current) lines.current.visible = fx.warp > 0.02;
  });

  return (
    <>
      <points ref={points} geometry={pointGeo} frustumCulled={false} renderOrder={-900}>
        <shaderMaterial
          uniforms={pointUniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          vertexShader={/* glsl */ `
            ${WRAP}
            attribute vec3 aColor; attribute float aSize; attribute float aSeed;
            uniform float uPR; uniform float uTime; uniform float uWarp;
            varying vec3 vCol; varying float vA;
            void main(){
              vec3 w = wrapPos(position);
              vec4 mv = viewMatrix * vec4(w, 1.0);
              gl_Position = projectionMatrix * mv;
              float dist = max(8.0, -mv.z);
              gl_PointSize = clamp(aSize * uPR * (150.0 / dist), 0.9 * uPR, 4.2 * uPR);
              float tw = 0.75 + 0.25 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 50.0);
              vCol = aColor;
              vA = edgeFade(position) * tw * (1.0 - uWarp * 0.85) * step(0.0, -mv.z);
            }
          `}
          fragmentShader={/* glsl */ `
            varying vec3 vCol; varying float vA;
            void main(){
              float d = length(gl_PointCoord - 0.5) * 2.0;
              float a = 1.0 - clamp(d, 0.0, 1.0);
              gl_FragColor = vec4(vCol * (0.55 + 0.9 * a), a * vA);
            }
          `}
        />
      </points>
      <lineSegments ref={lines} geometry={lineGeo} frustumCulled={false} renderOrder={-899} visible={false}>
        <shaderMaterial
          uniforms={shared}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          vertexShader={/* glsl */ `
            ${WRAP}
            attribute vec3 aColor; attribute float aEnd; attribute float aSeed;
            uniform float uWarp;
            varying vec3 vCol; varying float vA;
            void main(){
              vec3 head = wrapPos(position);
              float len = uWarp * (10.0 + aSeed * 90.0);
              vec3 w = head + uFwd * aEnd * len;
              vec4 mv = viewMatrix * vec4(w, 1.0);
              gl_Position = projectionMatrix * mv;
              vCol = aColor;
              vA = edgeFade(position) * uWarp * (1.0 - aEnd) * (0.35 + 0.65 * aSeed);
            }
          `}
          fragmentShader={/* glsl */ `
            varying vec3 vCol; varying float vA;
            void main(){ gl_FragColor = vec4(vCol * 1.4, vA); }
          `}
        />
      </lineSegments>
    </>
  );
}
