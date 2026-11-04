import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  Sprite,
} from 'three';
import { audio } from '../../core/audio';
import { useStore } from '../../core/store';
import { mulberry32 } from '../../core/util';
import { NOISE } from '../../gfx/glsl';
import { getGlowTexture } from '../../gfx/textures';
import { omega, type GalaxyObject } from '../../data/galaxy';
import { galaxyClock } from './galaxyApi';

const bodyShader = {
  vertex: /* glsl */ `
    varying vec3 vPos; varying vec3 vN;
    void main(){
      vPos = position;
      vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragment: /* glsl */ `
    uniform vec3 uColor; uniform float uTime; uniform float uSeed; uniform float uGlow;
    varying vec3 vPos; varying vec3 vN;
    ${NOISE}
    void main(){
      vec3 p = normalize(vPos);
      float n = fbm(p * 2.6 + uSeed + uTime * 0.05) * 0.5 + 0.5;
      float lit = clamp(dot(normalize(vN), normalize(vec3(0.6, 0.5, 0.7))) * 0.5 + 0.55, 0.0, 1.0);
      vec3 col = uColor * (0.25 + 0.75 * lit) * (0.6 + 0.7 * n);
      float rim = pow(1.0 - clamp(abs(vN.z), 0.0, 1.0), 2.2);
      col += uColor * rim * 0.6 + vec3(1.0) * uGlow * 0.35;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

interface Props {
  obj: GalaxyObject;
  index: number;
  onGroup: (id: string, g: Group | null) => void;
}

export function GalaxyObjectMesh({ obj, index, onGroup }: Props) {
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const halo = useRef<Sprite>(null);
  const spin = useRef<Group>(null);
  const hover = useRef(false);
  const selected = useStore((s) => s.galaxySelected === obj.id);
  const galaxySelect = useStore((s) => s.galaxySelect);
  const glow = useMemo(() => getGlowTexture(), []);
  const color = useMemo(() => new Color(obj.color), [obj.color]);
  const uniforms = useMemo(
    () => ({ uColor: { value: [color.r, color.g, color.b] }, uTime: { value: 0 }, uSeed: { value: index * 7.3 }, uGlow: { value: 0 } }),
    [color, index],
  );

  // debris field: a small cloud of fragments
  const fragments = useMemo(() => {
    if (obj.id !== 'ossuary') return null;
    const rand = mulberry32(5);
    return Array.from({ length: 26 }, () => ({
      p: [(rand() - 0.5) * 2.4, (rand() - 0.5) * 0.9, (rand() - 0.5) * 2.4] as [number, number, number],
      s: 0.05 + rand() * 0.12,
      r: [rand() * 3, rand() * 3, rand() * 3] as [number, number, number],
    }));
  }, [obj.id]);
  const dummy = useMemo(() => new Object3D(), []);
  const instanced = useRef<InstancedMesh>(null);

  useFrame((state, dt) => {
    const t = galaxyClock.t;
    const a = obj.a0 + t * omega(obj.r);
    group.current?.position.set(Math.cos(a) * obj.r, obj.y, Math.sin(a) * obj.r);
    uniforms.uTime.value += dt;
    const active = selected || hover.current;
    uniforms.uGlow.value += ((active ? 1 : 0) - uniforms.uGlow.value) * Math.min(1, dt * 8);
    if (ring.current) {
      ring.current.quaternion.copy(state.camera.quaternion);
      const target = selected ? 1 : hover.current ? 0.8 : 0;
      const s = obj.size * (2.3 + Math.sin(state.clock.elapsedTime * 3) * 0.1);
      ring.current.scale.setScalar(s);
      const m = ring.current.material as unknown as { opacity: number };
      m.opacity += (target - m.opacity) * Math.min(1, dt * 8);
    }
    if (halo.current) {
      const base = obj.size * (obj.id === 'orrin' ? 9 : 5.2);
      const pulse = obj.id === 'vael' ? 1 + Math.sin(state.clock.elapsedTime * 4.7) * 0.25 : 1;
      halo.current.scale.setScalar(base * pulse * (1 + uniforms.uGlow.value * 0.25));
    }
    if (spin.current) {
      if (obj.id === 'vael') spin.current.rotation.z += dt * 4.7;
      if (obj.id === 'halcyon') {
        spin.current.rotation.x += dt * 0.4;
        spin.current.rotation.y += dt * 0.25;
      }
      if (obj.id === 'thessaly') spin.current.rotation.z += dt * 0.8;
    }
    if (instanced.current && fragments) {
      fragments.forEach((f, i) => {
        dummy.position.set(...f.p);
        dummy.rotation.set(f.r[0] + t * 0.3, f.r[1] + t * 0.2, f.r[2]);
        dummy.scale.setScalar(f.s);
        dummy.updateMatrix();
        instanced.current!.setMatrixAt(i, dummy.matrix);
      });
      instanced.current.instanceMatrix.needsUpdate = true;
    }
  });

  const hitR = Math.max(obj.size * 1.9, 1.5);
  const isWorld = !!obj.world;

  return (
    <group
      ref={(g) => {
        (group as { current: Group | null }).current = g;
        onGroup(obj.id, g);
      }}
    >
      <sprite ref={halo} renderOrder={5}>
        <spriteMaterial map={glow} color={obj.color} transparent depthWrite={false} blending={AdditiveBlending} opacity={isWorld ? 0.55 : 0.4} />
      </sprite>

      <group ref={spin}>
        {obj.id === 'halcyon' && (
          <mesh>
            <torusGeometry args={[obj.size, 0.07, 10, 64]} />
            <meshBasicMaterial color={obj.color} toneMapped={false} />
          </mesh>
        )}
        {obj.id === 'thessaly' && (
          <>
            <mesh>
              <sphereGeometry args={[obj.size * 0.55, 24, 24]} />
              <meshBasicMaterial color="#02030a" />
            </mesh>
            <mesh>
              <torusGeometry args={[obj.size, 0.09, 10, 64]} />
              <meshBasicMaterial color={obj.color} toneMapped={false} transparent opacity={0.9} blending={AdditiveBlending} />
            </mesh>
          </>
        )}
        {obj.id === 'vael' && (
          <>
            <mesh ref={body}>
              <sphereGeometry args={[obj.size * 0.4, 20, 20]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.12, 4.2, 12, 1, true]} />
              <meshBasicMaterial color="#27D8F2" transparent opacity={0.55} blending={AdditiveBlending} side={DoubleSide} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.12, 4.2, 12, 1, true]} />
              <meshBasicMaterial color="#27D8F2" transparent opacity={0.55} blending={AdditiveBlending} side={DoubleSide} depthWrite={false} toneMapped={false} />
            </mesh>
          </>
        )}
      </group>

      {fragments && (
        <instancedMesh ref={instanced} args={[undefined, undefined, fragments.length]}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={obj.color} toneMapped={false} />
        </instancedMesh>
      )}

      {(isWorld || obj.id === 'orrin') && (
        <mesh ref={body}>
          <sphereGeometry args={[obj.size * 0.62, 32, 32]} />
          <shaderMaterial uniforms={uniforms} vertexShader={bodyShader.vertex} fragmentShader={bodyShader.fragment} />
        </mesh>
      )}

      <mesh ref={ring} renderOrder={6}>
        <ringGeometry args={[0.92, 1, 56]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>

      <mesh
        onClick={(e) => {
          e.stopPropagation();
          audio.play('select');
          galaxySelect(obj.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          hover.current = true;
          document.body.style.cursor = 'pointer';
          audio.play('hover');
        }}
        onPointerOut={() => {
          hover.current = false;
          document.body.style.cursor = '';
        }}
        visible={false}
      >
        <sphereGeometry args={[hitR, 12, 12]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
