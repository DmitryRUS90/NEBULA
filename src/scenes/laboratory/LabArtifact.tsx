import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PointsMaterial,
  Quaternion,
  Sprite,
  Vector3,
} from 'three';
import { audio } from '../../core/audio';
import { TIERS } from '../../core/perf';
import { useStore } from '../../core/store';
import { mulberry32, prefersReducedMotion, rgb } from '../../core/util';
import { NOISE, SOFT_POINT } from '../../gfx/glsl';
import { getGlowTexture } from '../../gfx/textures';
import { labApi, tintFor, type LabUniforms } from './labApi';
import { NODES, NODE_RADIUS } from './labData';
import { toggleNode } from './labActions';

const PULSE_R = 1.95;

/** Uniforms and helpers every laboratory fragment shader shares. */
const COMMON = /* glsl */ `
uniform float uTime; uniform vec4 uW; uniform float uNodes; uniform float uRes;
uniform float uPulseT; uniform vec3 uPulseDir; uniform vec3 uPulseCol; uniform float uEnergy;
vec3 pal(float t){ return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67))); }
vec3 modeCol(float n, float h){
  float t = clamp(n * 0.5 + 0.5, 0.0, 1.0);
  vec3 spec = mix(vec3(0.45, 0.35, 1.0), pal(t * 0.8 + h), 0.75);
  vec3 therm = mix(vec3(0.2, 0.05, 0.5), vec3(1.0, 0.45, 0.1), smoothstep(0.2, 0.7, t));
  therm = mix(therm, vec3(1.0, 0.95, 0.8), smoothstep(0.7, 1.0, t));
  vec3 stru = mix(vec3(0.1, 0.2, 0.5), vec3(0.45, 0.65, 1.0), t);
  vec3 fld = mix(vec3(0.05, 0.3, 0.5), vec3(0.3, 0.95, 1.0), t);
  return spec * uW.x + therm * uW.y + stru * uW.z + fld * uW.w;
}
float pulseBand(vec3 p){
  float pd = dot(normalize(p), normalize(uPulseDir));
  float front = mix(-1.0, 1.0, uPulseT);
  return exp(-pow((pd - front) * 3.2, 2.0)) * sin(3.14159 * uPulseT);
}
`;

const VERT = /* glsl */ `
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main(){
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const CORE_FRAG = /* glsl */ `
${NOISE}
${COMMON}
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main(){
  float t = uTime;
  float n = fbm(vP * 1.8 + vec3(0.0, t * 0.25, t * 0.15));
  float n2 = snoise(vP * 4.0 - t * 0.4);
  float fres = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.0);
  vec3 col = modeCol(n, n2 * 0.15 + t * 0.02);
  float inten = 0.55 + 0.12 * uNodes + 0.5 * uEnergy;
  float beat = 0.5 + 0.5 * sin(t * (2.0 + uNodes * 0.8));
  col *= inten * (0.85 + 0.3 * beat);
  col += modeCol(0.8, 0.1) * fres * 0.9;
  float cells = 1.0 - smoothstep(0.0, 0.08, abs(n2));
  col += vec3(0.5, 0.7, 1.0) * cells * uW.z * 0.8;
  col = mix(col, vec3(1.0), uRes * 0.4 * (0.5 + 0.5 * sin(t * 6.0)));
  col += uPulseCol * pulseBand(vP) * 1.2;
  gl_FragColor = vec4(col, 1.0);
}
`;

const SHELL_FRAG = /* glsl */ `
${NOISE}
${COMMON}
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main(){
  float t = uTime;
  vec3 N = normalize(vN); vec3 V = normalize(vV);
  float fres = pow(1.0 - abs(dot(N, V)), 2.2);
  float n = fbm(vP * 1.3 + vec3(t * 0.1, 0.0, t * 0.07));
  float iso = 1.0 - smoothstep(0.0, 0.09, abs(sin(n * 14.0)));
  vec3 base = modeCol(n, vP.y * 0.1);
  float a = fres * 0.85 + 0.04;
  a += iso * (0.16 + 0.5 * uW.z);
  a += uW.y * smoothstep(0.1, 0.9, n * 0.5 + 0.5) * 0.35;
  a += uW.x * (0.5 + 0.5 * sin(vP.y * 9.0 + t)) * 0.18;
  a *= 0.8 + 0.1 * uNodes;
  float band = pulseBand(vP);
  a += band * 0.7;
  base = mix(base, vec3(1.0), uRes * 0.35);
  a *= 1.0 + uRes * 0.6 * (0.5 + 0.5 * sin(t * 6.0));
  vec3 col = base + uPulseCol * band;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`;

const PARTICLE_VERT = /* glsl */ `
attribute float aL; attribute float aPhi; attribute float aSeed;
uniform float uTime; uniform float uPR; uniform vec4 uW; uniform float uRes;
varying float vA; varying float vS;
void main(){
  float th0 = asin(sqrt(1.1 / aL));
  float u = fract(aSeed + uTime * (0.035 + 0.03 * aSeed));
  float th = mix(th0, 3.14159 - th0, u);
  float s = sin(th);
  float r = aL * s * s;
  vec3 p = vec3(r * s * cos(aPhi), r * cos(th), r * s * sin(aPhi));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(1.0, -mv.z);
  gl_PointSize = clamp((1.4 + aSeed * 1.6) * uPR * (34.0 / dist), uPR, 7.0 * uPR);
  vA = sin(u * 3.14159) * (0.22 + 0.78 * uW.w + 0.3 * uRes);
  vS = aSeed;
}
`;

const PARTICLE_FRAG = /* glsl */ `
${SOFT_POINT}
uniform float uRes;
varying float vA; varying float vS;
void main(){
  vec3 c = mix(vec3(0.25, 0.9, 1.0), vec3(1.0), vS * 0.4 + uRes * 0.5);
  gl_FragColor = vec4(c, softPoint() * clamp(vA, 0.0, 1.0));
}
`;

export function Core({ u, oct }: { u: LabUniforms; oct: number }) {
  const tier = useStore((s) => s.tier);
  const seg = tier === 'lite' ? 24 : 40;
  return (
    <mesh renderOrder={1}>
      <sphereGeometry args={[0.95, seg, seg]} />
      <shaderMaterial uniforms={u} transparent depthWrite={false} blending={AdditiveBlending} defines={{ OCT: oct }} vertexShader={VERT} fragmentShader={CORE_FRAG} />
    </mesh>
  );
}

export function Shell({ u, oct }: { u: LabUniforms; oct: number }) {
  const detail = TIERS[useStore((s) => s.tier)].labDetail;
  return (
    <mesh renderOrder={2}>
      <icosahedronGeometry args={[1.9, detail]} />
      <shaderMaterial
        uniforms={u}
        transparent
        depthWrite={false}
        side={DoubleSide}
        blending={AdditiveBlending}
        defines={{ OCT: oct }}
        vertexShader={VERT}
        fragmentShader={SHELL_FRAG}
      />
    </mesh>
  );
}

/** Lattice frame and its anchor points. They glow in structure mode. */
export function Frame({ u }: { u: LabUniforms }) {
  const glow = useMemo(() => getGlowTexture(), []);
  const lineMat = useRef<LineBasicMaterial>(null);
  const pointMat = useRef<PointsMaterial>(null);
  const { edges, pts } = useMemo(() => {
    const ico = new IcosahedronGeometry(2.35, 1);
    const e = new EdgesGeometry(ico, 1);
    const pos = ico.getAttribute('position');
    const seen = new Set<string>();
    const arr: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const k = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
      if (!seen.has(k)) {
        seen.add(k);
        arr.push(x, y, z);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(arr, 3));
    ico.dispose();
    return { edges: e, pts: g };
  }, []);

  useFrame(() => {
    const w = u.uW.value;
    if (lineMat.current) {
      lineMat.current.opacity = 0.14 + 0.7 * w.z + 0.15 * u.uRes.value;
      tintFor(lineMat.current.color, w);
    }
    if (pointMat.current) {
      pointMat.current.opacity = 0.25 + 0.75 * w.z;
      tintFor(pointMat.current.color, w);
    }
  });

  return (
    <>
      <lineSegments geometry={edges} renderOrder={3}>
        <lineBasicMaterial ref={lineMat} transparent depthWrite={false} blending={AdditiveBlending} />
      </lineSegments>
      <points geometry={pts} renderOrder={3}>
        <pointsMaterial ref={pointMat} map={glow} size={0.55} sizeAttenuation transparent depthWrite={false} blending={AdditiveBlending} />
      </points>
    </>
  );
}

/** Dipole field lines plus particles that drift along them. Both brighten in field mode. */
export function Field({ u }: { u: LabUniforms }) {
  const tier = useStore((s) => s.tier);
  const cfg = TIERS[tier];
  const dpr = useThree((s) => s.viewport.dpr);
  const lineMat = useRef<LineBasicMaterial>(null);

  const lines = useMemo(() => {
    const count = cfg.fieldPoints > 2000 ? 14 : cfg.fieldPoints > 1000 ? 10 : 6;
    const pos: number[] = [];
    const seg = 48;
    for (let k = 0; k < count; k++) {
      const phi = (k / count) * Math.PI * 2;
      for (const L of [3.0, 4.1]) {
        const th0 = Math.asin(Math.sqrt(1.12 / L));
        let px = 0;
        let py = 0;
        let pz = 0;
        for (let i = 0; i <= seg; i++) {
          const th = th0 + (Math.PI - 2 * th0) * (i / seg);
          const s = Math.sin(th);
          const r = L * s * s;
          const x = r * s * Math.cos(phi);
          const y = r * Math.cos(th);
          const z = r * s * Math.sin(phi);
          if (i > 0) pos.push(px, py, pz, x, y, z);
          px = x;
          py = y;
          pz = z;
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    return g;
  }, [cfg.fieldPoints]);

  const particles = useMemo(() => {
    const rand = mulberry32(7);
    const n = cfg.fieldPoints;
    const L = new Float32Array(n);
    const phi = new Float32Array(n);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      L[i] = 2.0 + rand() * 2.4;
      phi[i] = rand() * Math.PI * 2;
      seed[i] = rand();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aL', new BufferAttribute(L, 1));
    g.setAttribute('aPhi', new BufferAttribute(phi, 1));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    return g;
  }, [cfg.fieldPoints]);

  const pu = useMemo(() => ({ ...u, uPR: { value: dpr } }), [u, dpr]);

  useFrame(() => {
    if (!lineMat.current) return;
    lineMat.current.opacity = 0.06 + 0.55 * u.uW.value.w;
  });

  return (
    <>
      <lineSegments geometry={lines} renderOrder={3}>
        <lineBasicMaterial ref={lineMat} color="#27D8F2" transparent depthWrite={false} blending={AdditiveBlending} />
      </lineSegments>
      <points geometry={particles} frustumCulled={false} renderOrder={3}>
        <shaderMaterial uniforms={pu} transparent depthWrite={false} blending={AdditiveBlending} vertexShader={PARTICLE_VERT} fragmentShader={PARTICLE_FRAG} />
      </points>
    </>
  );
}

/** A clickable node on the shell. Active nodes draw a beam to the core and a turning ring. */
export function LabNode({ index, active }: { index: number; active: boolean }) {
  const def = NODES[index];
  const glow = useMemo(() => getGlowTexture(), []);
  const dir = useMemo(() => new Vector3(...def.dir).normalize(), [def]);
  const pos = useMemo(() => dir.clone().multiplyScalar(NODE_RADIUS), [dir]);
  const beamLen = NODE_RADIUS - 0.95;
  const beamQuat = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir), [dir]);
  const ringQuat = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir), [dir]);
  const beamPos = useMemo(() => dir.clone().multiplyScalar(-beamLen / 2), [dir, beamLen]);
  const full = useMemo(() => rgb(def.color), [def]);

  const body = useRef<Mesh>(null);
  const bodyMat = useRef<MeshBasicMaterial>(null);
  const halo = useRef<Sprite>(null);
  const beam = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const k = useRef(active ? 1 : 0);
  const hover = useRef(0);
  const hovered = useRef(false);
  const target = useRef(active);
  target.current = active;

  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
  );

  useFrame((state, dt) => {
    const a = 1 - Math.exp(-dt * 6);
    k.current += ((target.current ? 1 : 0) - k.current) * a;
    hover.current += ((hovered.current ? 1 : 0) - hover.current) * a;
    const kk = k.current;
    const t = state.clock.elapsedTime;
    if (body.current) {
      body.current.scale.setScalar((0.8 + 0.5 * kk) * (1 + 0.25 * hover.current));
      body.current.rotation.y += dt * (0.6 + kk);
    }
    if (bodyMat.current) {
      const dim = 0.35 + 0.65 * kk + 0.2 * hover.current;
      bodyMat.current.color.setRGB(full.x, full.y, full.z).multiplyScalar(dim);
    }
    if (halo.current) {
      const s = 1.1 + 0.9 * kk + 0.3 * hover.current;
      halo.current.scale.set(s, s, 1);
      halo.current.material.opacity = 0.15 + 0.7 * kk;
    }
    if (beam.current) {
      const m = beam.current.material as MeshBasicMaterial;
      m.opacity = kk * (0.45 + 0.2 * Math.sin(t * 4 + index));
      beam.current.visible = kk > 0.01;
    }
    if (ring.current) {
      const m = ring.current.material as MeshBasicMaterial;
      m.opacity = kk * 0.8;
      ring.current.visible = kk > 0.01;
      ring.current.rotation.z += dt * 1.2;
    }
  });

  return (
    <group position={pos} renderOrder={4}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          toggleNode(index);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          hovered.current = true;
          document.body.style.cursor = 'pointer';
          audio.play('hover');
        }}
        onPointerOut={() => {
          hovered.current = false;
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={body}>
        <octahedronGeometry args={[0.26, 0]} />
        <meshBasicMaterial ref={bodyMat} />
      </mesh>
      <sprite ref={halo} scale={[1.2, 1.2, 1]}>
        <spriteMaterial map={glow} color={def.color} transparent depthWrite={false} blending={AdditiveBlending} opacity={0.2} />
      </sprite>
      <mesh ref={ring} quaternion={ringQuat} visible={false}>
        <torusGeometry args={[0.46, 0.012, 6, 40]} />
        <meshBasicMaterial color={def.color} transparent depthWrite={false} blending={AdditiveBlending} opacity={0} />
      </mesh>
      <mesh ref={beam} position={beamPos} quaternion={beamQuat} visible={false}>
        <cylinderGeometry args={[0.025, 0.07, beamLen, 8, 1, true]} />
        <meshBasicMaterial color={def.color} transparent depthWrite={false} blending={AdditiveBlending} opacity={0} />
      </mesh>
    </group>
  );
}

/** The ring that sweeps across the shell while a pulse travels. Registers labApi.pulse. */
export function PulseRing({ u }: { u: LabUniforms }) {
  const mesh = useRef<Mesh>(null);
  const mat = useRef<MeshBasicMaterial>(null);
  const dir = useMemo(() => new Vector3(0, 1, 0), []);
  const z = useMemo(() => new Vector3(0, 0, 1), []);

  useEffect(() => {
    const slow = prefersReducedMotion();
    labApi.pulse = (d, color = '#e8f6ff') => {
      if (d) dir.set(d[0], d[1], d[2]);
      else dir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      if (dir.lengthSq() < 0.01) dir.set(0, 1, 0);
      dir.normalize();
      u.uPulseDir.value.copy(dir);
      u.uPulseCol.value.copy(rgb(color));
      mat.current?.color.set(color);
      mesh.current?.quaternion.setFromUnitVectors(z, dir);
      gsap.fromTo(u.uPulseT, { value: 0 }, { value: 1, duration: slow ? 1.2 : 2.2, ease: 'power1.inOut', overwrite: 'auto' });
    };
    return () => {
      labApi.pulse = () => {};
      gsap.killTweensOf(u.uPulseT);
    };
  }, [u, dir, z]);

  useFrame(() => {
    const m = mesh.current;
    const t = u.uPulseT.value;
    if (!m || !mat.current) return;
    if (t >= 0.999) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const p = (t * 2 - 1) * PULSE_R;
    m.position.copy(dir).multiplyScalar(p);
    const s = Math.sqrt(Math.max(0.0001, PULSE_R * PULSE_R - p * p));
    m.scale.set(s, s, 1);
    mat.current.opacity = Math.sin(Math.PI * t) * 0.85;
  });

  return (
    <mesh ref={mesh} visible={false} renderOrder={5}>
      <ringGeometry args={[0.985, 1, 96]} />
      <meshBasicMaterial ref={mat} transparent depthWrite={false} blending={AdditiveBlending} side={DoubleSide} opacity={0} />
    </mesh>
  );
}
