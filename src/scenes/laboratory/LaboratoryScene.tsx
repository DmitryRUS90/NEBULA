import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Group, SpriteMaterial, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { audio } from '../../core/audio';
import { fx } from '../../core/fx';
import { useFit, useIsPortrait } from '../../core/hooks';
import { useStore, type LabMode } from '../../core/store';
import { prefersReducedMotion } from '../../core/util';
import { getGlowTexture } from '../../gfx/textures';
import { Core, Field, Frame, LabNode, PulseRing, Shell } from './LabArtifact';
import { createUniforms, labApi, tintFor } from './labApi';
import { NODES } from './labData';

const WEIGHTS: Record<LabMode, [number, number, number, number]> = {
  spectral: [1, 0, 0, 0],
  thermal: [0, 1, 0, 0],
  structure: [0, 0, 1, 0],
  field: [0, 0, 0, 1],
};

export function LaboratoryScene() {
  const tier = useStore((s) => s.tier);
  const mode = useStore((s) => s.labMode);
  const nodes = useStore((s) => s.labNodes);
  const scale = useStore((s) => s.labScale);
  const spin = useStore((s) => s.labSpin);
  const fit = useFit();
  const portrait = useIsPortrait();
  const camera = useThree((s) => s.camera);
  const controls = useRef<OrbitControlsImpl>(null);
  const u = useMemo(() => createUniforms(), []);
  const art = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const glowMat = useRef<SpriteMaterial>(null);
  const glow = useMemo(() => getGlowTexture(), []);
  const reduce = useMemo(() => prefersReducedMotion(), []);
  const oct = tier === 'lite' ? 2 : tier === 'balanced' ? 3 : 4;
  const home = useMemo(() => new Vector3(0, 1.8 * fit, 9.3 * fit), [fit]);

  const arrived = useRef(false);
  const idleUntil = useRef(0);
  const shown = useRef(scale);
  const live = useRef({ scale, spin, portrait, fit });
  live.current = { scale, spin, portrait, fit };
  const firstMode = useRef(true);
  const firstNodes = useRef(true);
  const prevCount = useRef(nodes.length);

  // arrival: fly in from far out
  useEffect(() => {
    fx.baseFov = 45;
    const c = controls.current;
    if (reduce) {
      camera.position.copy(home);
      c?.target.set(0, 0, 0);
      c?.update();
      arrived.current = true;
      return;
    }
    const from = new Vector3(0, 7 * fit, 30 * fit);
    camera.position.copy(from);
    if (c) {
      c.target.set(0, 0, 0);
      c.enabled = false;
    }
    const proxy = { k: 0 };
    gsap.to(proxy, {
      k: 1,
      duration: 2.2,
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const onStart = () => {
      idleUntil.current = performance.now() + 4500;
    };
    c.addEventListener('start', onStart);
    return () => c.removeEventListener('start', onStart);
  }, []);

  // visualization mode: crossfade the weights
  useEffect(() => {
    const w = WEIGHTS[mode];
    gsap.to(u.uW.value, { x: w[0], y: w[1], z: w[2], w: w[3], duration: firstMode.current ? 0 : 1, ease: 'nebula', overwrite: 'auto' });
    firstMode.current = false;
  }, [mode, u]);

  // active nodes: energy, resonance and the lock moment
  useEffect(() => {
    const n = nodes.length;
    const d = firstNodes.current ? 0 : 0.8;
    gsap.to(u.uNodes, { value: n, duration: d, ease: 'nebula', overwrite: 'auto' });
    gsap.to(u.uRes, { value: n === 4 ? 1 : 0, duration: firstNodes.current ? 0 : 1.2, ease: 'nebula', overwrite: 'auto' });
    gsap.to(u.uEnergy, { value: 0.3 + n * 0.17, duration: d, ease: 'nebula', overwrite: 'auto' });
    if (n === 4 && prevCount.current < 4) {
      audio.play('success');
      useStore.getState().showToast('Resonance reached. The lattice is locked.');
      labApi.pulse(undefined, '#ffffff');
    }
    prevCount.current = n;
    firstNodes.current = false;
  }, [nodes.length, u]);

  // a larger artifact needs the camera further back
  useEffect(() => {
    const c = controls.current;
    if (!c || !arrived.current) return;
    const needed = home.length() * Math.max(1, scale * 0.92);
    const off = camera.position.clone().sub(c.target);
    if (off.length() >= needed) return;
    const to = c.target.clone().add(off.setLength(needed));
    gsap.to(camera.position, { x: to.x, y: to.y, z: to.z, duration: 0.8, ease: 'nebula', overwrite: 'auto', onUpdate: () => c.update() });
  }, [scale, camera, home]);

  useEffect(() => {
    labApi.resetView = () => {
      const c = controls.current;
      if (!c) return;
      const lift = labApi.sheetOpen && live.current.portrait ? -1.3 * live.current.fit : 0;
      const dist = Math.max(1, live.current.scale * 0.92);
      idleUntil.current = performance.now() + 2500;
      gsap.to(c.target, { x: 0, y: lift, z: 0, duration: 1.2, ease: 'nebula', overwrite: 'auto' });
      gsap.to(camera.position, { x: home.x * dist, y: home.y * dist + lift, z: home.z * dist, duration: 1.4, ease: 'nebula', overwrite: 'auto', onUpdate: () => c.update() });
      if (inner.current) gsap.to(inner.current.rotation, { y: 0, duration: 1.2, ease: 'nebula', overwrite: 'auto' });
    };
    return () => {
      labApi.resetView = () => {};
    };
  }, [camera, home]);

  useEffect(
    () => () => {
      gsap.killTweensOf(u.uW.value);
      gsap.killTweensOf(u.uNodes);
      gsap.killTweensOf(u.uRes);
      gsap.killTweensOf(u.uEnergy);
    },
    [u],
  );

  useFrame((_, dt) => {
    u.uTime.value += reduce ? dt * 0.5 : dt;
    const l = live.current;
    shown.current += (l.scale - shown.current) * (1 - Math.exp(-dt * 6));
    art.current?.scale.setScalar(shown.current);
    if (inner.current && l.spin && !reduce) inner.current.rotation.y += dt * 0.12;
    if (glowMat.current) tintFor(glowMat.current.color, u.uW.value);

    const c = controls.current;
    if (!c || !arrived.current) return;
    c.autoRotate = l.spin && !reduce && performance.now() > idleUntil.current;
    // the mobile sheet covers the lower part of the screen, so the artifact rises above it
    const lift = labApi.sheetOpen && l.portrait ? -1.3 * l.fit : 0;
    if (Math.abs(c.target.y - lift) > 0.01 && !gsap.isTweening(c.target)) c.target.y += (lift - c.target.y) * (1 - Math.exp(-dt * 4));
  });

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.06}
        minDistance={4.5}
        maxDistance={17 * fit}
        enablePan={false}
        rotateSpeed={0.6}
        zoomSpeed={0.7}
        autoRotateSpeed={0.9}
      />
      <sprite scale={[11, 11, 1]} renderOrder={0}>
        <spriteMaterial ref={glowMat} map={glow} transparent depthWrite={false} blending={AdditiveBlending} opacity={0.3} />
      </sprite>
      <group ref={art}>
        <Core u={u} oct={oct} />
        <Shell u={u} oct={oct} />
        <group ref={inner}>
          <Frame u={u} />
          <Field u={u} />
        </group>
        {NODES.map((_, i) => (
          <LabNode key={i} index={i} active={nodes.includes(i)} />
        ))}
        <PulseRing u={u} />
      </group>
    </>
  );
}
