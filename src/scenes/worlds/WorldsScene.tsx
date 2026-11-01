import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import { MathUtils, type Group } from 'three';
import { fx, tintTo } from '../../core/fx';
import { useFit } from '../../core/hooks';
import { useStore } from '../../core/store';
import { clamp, prefersReducedMotion } from '../../core/util';
import { WORLDS } from '../../data/worlds';
import { createLook, firePulse, tweenLook } from './look';
import { Halo, Moons, PlanetBody, Ring, Weather } from './PlanetMesh';

const IDLE_SPIN = 0.07;
const BASE_TILT = 0.14;

export function WorldsScene() {
  const world = useStore((s) => s.world);
  const fit = useFit();
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const stacked = size.width / size.height < 1.1;

  // the live look starts on the world picked in the galaxy and is tweened from there
  const look = useMemo(() => createLook(useStore.getState().world), []);
  const pulse = useMemo(() => ({ v: 0 }), []);
  const intro = useMemo(() => ({ k: 1 }), []);

  const root = useRef<Group>(null);
  const tilt = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const placed = useRef(false);
  const drag = useRef({ down: false, x: 0, y: 0, t: 0, vel: IDLE_SPIN, tiltX: BASE_TILT });
  const first = useRef(true);

  // arrival: the camera settles in from further out
  useEffect(() => {
    fx.baseFov = 42;
    if (prefersReducedMotion()) return;
    intro.k = 1.3;
    gsap.to(intro, { k: 1, duration: 2.2, ease: 'power3.out' });
    return () => {
      gsap.killTweensOf(intro);
    };
  }, [intro]);

  // a new world: morph the look, flare, and shift the nebula behind it
  useEffect(() => {
    const w = WORLDS[world];
    tintTo(w.tint[0], w.tint[1], w.tint[2], first.current ? 1.2 : 1.6);
    if (!first.current) {
      tweenLook(look, world);
      firePulse(pulse);
    }
    first.current = false;
  }, [world, look, pulse]);

  useEffect(
    () => () => {
      gsap.killTweensOf(look);
      gsap.killTweensOf(look.colA);
      gsap.killTweensOf(look.colB);
      gsap.killTweensOf(look.vein);
      gsap.killTweensOf(look.atmo);
      gsap.killTweensOf(look.light);
      gsap.killTweensOf(look.wColor);
      gsap.killTweensOf(look.wVel);
      gsap.killTweensOf(pulse);
    },
    [look, pulse],
  );

  // drag to turn the planet, with inertia
  useEffect(() => {
    const el = gl.domElement;
    const d = drag.current;
    const onDown = (e: PointerEvent) => {
      d.down = true;
      d.x = e.clientX;
      d.y = e.clientY;
      d.t = performance.now();
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const onMove = (e: PointerEvent) => {
      if (!d.down || !spin.current) return;
      const now = performance.now();
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      const dtMs = Math.max(8, now - d.t);
      spin.current.rotation.y += dx * 0.006;
      d.tiltX = clamp(d.tiltX + dy * 0.003, -0.55, 0.65);
      d.vel = clamp(((dx * 0.006) / dtMs) * 1000, -4, 4);
      d.x = e.clientX;
      d.y = e.clientY;
      d.t = now;
    };
    const onUp = (e: PointerEvent) => {
      if (!d.down) return;
      d.down = false;
      el.releasePointerCapture?.(e.pointerId);
      el.style.cursor = 'grab';
      // a pause before letting go means no throw
      if (performance.now() - d.t > 90) d.vel = IDLE_SPIN;
    };
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.style.cursor = '';
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [gl]);

  useFrame((state, dt) => {
    const d = drag.current;
    const D = 9 * fit * intro.k;
    const halfH = Math.tan(MathUtils.degToRad(fx.baseFov / 2)) * 9 * fit;
    const panelPx = Math.min(416, size.width * 0.4);
    const tx = stacked ? 0 : (halfH * panelPx) / size.height;
    const ty = stacked ? halfH * 0.36 : -0.05;
    const ease = 1 - Math.exp(-dt * 4);

    const r = root.current;
    if (r) {
      if (!placed.current) {
        r.position.set(tx, ty, 0);
        placed.current = true;
      } else {
        r.position.x += (tx - r.position.x) * ease;
        r.position.y += (ty - r.position.y) * ease;
      }
      const s = (stacked && size.width / size.height < 0.85 ? 0.9 : 1) * (0.88 + 0.12 / intro.k) * (1 + 0.045 * pulse.v);
      r.scale.setScalar(s);
      // pointer parallax
      r.rotation.y += (state.pointer.x * 0.1 - r.rotation.y) * Math.min(1, dt * 2);
      r.rotation.x += (-state.pointer.y * 0.06 - r.rotation.x) * Math.min(1, dt * 2);
    }

    if (!d.down) {
      d.vel += (IDLE_SPIN - d.vel) * (1 - Math.exp(-dt * 1.1));
      d.tiltX += (BASE_TILT - d.tiltX) * (1 - Math.exp(-dt * 0.5));
      if (spin.current) spin.current.rotation.y += d.vel * dt;
    }
    if (tilt.current) tilt.current.rotation.x = d.tiltX;

    state.camera.position.set(state.pointer.x * 0.3, 0.35, D);
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={root}>
      <group ref={tilt} rotation={[BASE_TILT, 0, 0.22]}>
        <group ref={spin}>
          <PlanetBody look={look} pulse={pulse} />
        </group>
        <Ring look={look} />
      </group>
      <Halo look={look} pulse={pulse} />
      <Weather look={look} />
      <Moons look={look} />
    </group>
  );
}
