import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial } from 'three';
import { audio } from '../../core/audio';
import { fx } from '../../core/fx';
import { useIsPortrait } from '../../core/hooks';
import { useStore } from '../../core/store';
import { prefersReducedMotion } from '../../core/util';
import { getGlowTexture } from '../../gfx/textures';
import { PortalGraphics } from '../portal/PortalGraphics';
import { beyondApi } from './beyondApi';
import { buildSlots, JOURNEY_RADIUS } from './journey';

const TAN_HALF_FOV = Math.tan((50 * Math.PI) / 360);
const GATE_SCALE = 0.5;

/** The final scene: a wide open gateway ringed by everything the traveller found. */
export function BeyondScene() {
  const size = useThree((s) => s.size);
  const portrait = useIsPortrait();
  const glow = useMemo(() => getGlowTexture(), []);
  const reduced = useMemo(() => prefersReducedMotion(), []);

  // the journey is fixed for as long as this scene is on screen, so it is read once
  const slots = useMemo(() => {
    const s = useStore.getState();
    return buildSlots({ scanned: s.scanned, worldsVisited: s.worldsVisited, labModes: s.labModes, labNodes: s.labNodes, coreBest: s.coreBest });
  }, []);

  const pathGeo = useMemo(() => {
    const found = slots.filter((s) => s.found);
    if (found.length < 2) return null;
    const pos = new Float32Array((found.length - 1) * 6);
    for (let i = 0; i < found.length - 1; i++) {
      pos.set([found[i].x, found[i].y, found[i].z, found[i + 1].x, found[i + 1].y, found[i + 1].z], i * 6);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    return g;
  }, [slots]);

  const aspect = size.width / size.height;
  const dist = useMemo(() => {
    const vertical = (JOURNEY_RADIUS * 0.95) / TAN_HALF_FOV / (portrait ? 0.5 : 1);
    const horizontal = (JOURNEY_RADIUS + 1) / (TAN_HALF_FOV * aspect);
    return Math.max(vertical, horizontal);
  }, [aspect, portrait]);
  const lift = portrait ? 2 * TAN_HALF_FOV * dist * 0.2 : 0;

  const sprites = useRef<(Sprite | null)[]>([]);
  const rings = useRef<(Mesh | null)[]>([]);
  const ripple = useRef<Mesh>(null);
  const group = useRef<Group>(null);
  const prog = useMemo(() => slots.map(() => ({ a: reduced ? 1 : 0 })), [slots, reduced]);
  const surge = useRef({ t: 1 });
  const openAmt = useRef(0.35);
  const drift = useRef({ x: 0, y: 0 });

  useEffect(() => {
    fx.baseFov = 50;
    if (!reduced) gsap.to(prog, { a: 1, duration: 1.4, ease: 'nebula', stagger: 0.07, delay: 0.9 });
    beyondApi.surge = () => {
      audio.play('success');
      const s = surge.current;
      gsap.killTweensOf(s);
      s.t = 0;
      gsap.to(s, { t: 1, duration: reduced ? 0.6 : 2.4, ease: 'power2.out' });
    };
    return () => {
      gsap.killTweensOf(prog);
      gsap.killTweensOf(surge.current);
      beyondApi.surge = () => {};
    };
  }, [prog, reduced]);

  useFrame((state, dt) => {
    const cam = state.camera;
    const k = Math.min(1, dt * 2);
    if (!reduced) {
      drift.current.x += (state.pointer.x - drift.current.x) * k;
      drift.current.y += (state.pointer.y - drift.current.y) * k;
    }
    cam.position.set(drift.current.x * 3.2, drift.current.y * 2.2, dist);
    cam.lookAt(0, 0, 0);
    if (group.current) group.current.position.y = lift;

    const t = surge.current.t;
    const wave = t * (JOURNEY_RADIUS + 8);
    openAmt.current = 0.35 + 0.5 * (1 - t) * (1 - t);

    if (ripple.current) {
      ripple.current.visible = t < 1;
      ripple.current.scale.setScalar(Math.max(0.01, wave));
      (ripple.current.material as MeshBasicMaterial).opacity = (1 - t) * 0.8;
    }

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const a = prog[i].a;
      const d = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
      const e = (wave - d) / 3;
      const boost = t < 1 ? Math.exp(-e * e) * (1 - t) : 0;
      const sp = sprites.current[i];
      if (sp) {
        const pulse = 1 + 0.12 * Math.sin(state.clock.elapsedTime * 1.6 + i);
        const sc = s.size * 3.4 * a * pulse * (1 + boost * 1.6);
        sp.scale.set(sc, sc, 1);
        (sp.material as SpriteMaterial).opacity = Math.min(1, 0.85 * a + boost);
      }
      const rg = rings.current[i];
      if (rg) {
        rg.scale.setScalar(s.size * (1 + boost * 0.8));
        (rg.material as MeshBasicMaterial).opacity = (0.22 + boost * 0.7) * a;
      }
    }
  });

  return (
    <group ref={group}>
      <group scale={GATE_SCALE}>
        <PortalGraphics open={() => openAmt.current} intensity={1.1} />
      </group>

      <mesh ref={ripple} visible={false} renderOrder={4}>
        <ringGeometry args={[0.97, 1, 128]} />
        <meshBasicMaterial color="#9ff3ff" transparent depthWrite={false} blending={AdditiveBlending} opacity={0} />
      </mesh>

      {pathGeo && (
        <lineSegments geometry={pathGeo} renderOrder={2}>
          <lineBasicMaterial color="#7ff0ff" transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} />
        </lineSegments>
      )}

      {slots.map((s, i) => (
        <group key={s.id} position={[s.x, s.y, s.z]}>
          {s.found ? (
            <sprite
              ref={(el) => {
                sprites.current[i] = el;
              }}
              renderOrder={3}
              scale={[0.001, 0.001, 1]}
            >
              <spriteMaterial map={glow} color={s.color} transparent depthWrite={false} blending={AdditiveBlending} opacity={0} />
            </sprite>
          ) : (
            <mesh
              ref={(el) => {
                rings.current[i] = el;
              }}
              renderOrder={2}
              scale={0.001}
            >
              <ringGeometry args={[0.8, 1, 32]} />
              <meshBasicMaterial color={s.color} transparent depthWrite={false} opacity={0} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
