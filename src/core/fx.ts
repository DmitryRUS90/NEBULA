import gsap from 'gsap';
import { Vector3 } from 'three';
import { rgb } from './util';
import type { SceneDef } from './scenes';

/**
 * Mutable per frame state shared by the 3D layer and the transition timeline.
 * It never goes through React: GSAP writes it, shaders read it.
 */
export const fx = {
  /** Hyperspace intensity 0..1 */
  warp: 0,
  /** Baseline star drift */
  cruise: 0.05,
  /** Accumulated star travel distance */
  travel: 0,
  /** Degrees added to the camera field of view */
  fovKick: 0,
  baseFov: 50,
  /** Portal opening 0..1 and camera dolly 0..1 */
  portalOpen: 0,
  dolly: 0,
  /** Nebula tint, raw display colours */
  tintA: rgb('#182B55'),
  tintB: rgb('#7356D9'),
  tintC: rgb('#27D8F2'),
  tintAmount: 1,
};

export function applyTint(def: SceneDef, duration = 1.6) {
  const target: [Vector3, string][] = [
    [fx.tintA, def.tint[0]],
    [fx.tintB, def.tint[1]],
    [fx.tintC, def.tint[2]],
  ];
  target.forEach(([v, hex]) => {
    const c = rgb(hex);
    gsap.to(v, { x: c.x, y: c.y, z: c.z, duration, ease: 'power2.inOut', overwrite: 'auto' });
  });
}

export function tintTo(a: string, b: string, c: string, duration = 1.4) {
  applyTint({ tint: [a, b, c] } as SceneDef, duration);
}

/** DOM elements of the transition overlay register themselves here so the timeline can drive them. */
export const overlayRefs: {
  top: HTMLElement | null;
  bottom: HTMLElement | null;
  flash: HTMLElement | null;
} = { top: null, bottom: null, flash: null };
