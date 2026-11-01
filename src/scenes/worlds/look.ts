import gsap from 'gsap';
import { Vector3 } from 'three';
import { prefersReducedMotion, rgb } from '../../core/util';
import { WORLDS, type WorldId } from '../../data/worlds';

/**
 * Live look of the planet. Shaders read these objects directly, GSAP tweens them in place,
 * so changing a world morphs the same planet instead of swapping it.
 */
export interface Look {
  colA: Vector3;
  colB: Vector3;
  vein: Vector3;
  atmo: Vector3;
  light: Vector3;
  wColor: Vector3;
  wVel: Vector3;
  veinAmt: number;
  veinScale: number;
  spotAmt: number;
  spotScale: number;
  gloss: number;
  hot: number;
  atmoPow: number;
  atmoAmt: number;
  ring: number;
  wSway: number;
  wSize: number;
  wAlpha: number;
}

export function createLook(id: WorldId): Look {
  const t = WORLDS[id].look;
  return {
    colA: rgb(t.colA),
    colB: rgb(t.colB),
    vein: rgb(t.vein),
    atmo: rgb(t.atmo),
    light: new Vector3(...t.light),
    wColor: rgb(t.weather.color),
    wVel: new Vector3(...t.weather.vel),
    veinAmt: t.veinAmt,
    veinScale: t.veinScale,
    spotAmt: t.spotAmt,
    spotScale: t.spotScale,
    gloss: t.gloss,
    hot: t.hot,
    atmoPow: t.atmoPow,
    atmoAmt: t.atmoAmt,
    ring: t.ring,
    wSway: t.weather.sway,
    wSize: t.weather.size,
    wAlpha: t.weather.alpha,
  };
}

const EASE = 'power2.inOut';

/** Tween the live look toward a world. Instant when motion is reduced. */
export function tweenLook(look: Look, id: WorldId, duration = 1.7) {
  const t = WORLDS[id].look;
  const d = prefersReducedMotion() ? 0 : duration;
  const vec = (v: Vector3, x: number, y: number, z: number) => gsap.to(v, { x, y, z, duration: d, ease: EASE, overwrite: 'auto' });
  const c = (hex: string) => rgb(hex);
  [
    [look.colA, c(t.colA)],
    [look.colB, c(t.colB)],
    [look.vein, c(t.vein)],
    [look.atmo, c(t.atmo)],
    [look.wColor, c(t.weather.color)],
  ].forEach(([v, to]) => vec(v, to.x, to.y, to.z));
  vec(look.light, ...t.light);
  vec(look.wVel, ...t.weather.vel);
  gsap.to(look, {
    veinAmt: t.veinAmt,
    veinScale: t.veinScale,
    spotAmt: t.spotAmt,
    spotScale: t.spotScale,
    gloss: t.gloss,
    hot: t.hot,
    atmoPow: t.atmoPow,
    atmoAmt: t.atmoAmt,
    ring: t.ring,
    wSway: t.weather.sway,
    wSize: t.weather.size,
    wAlpha: t.weather.alpha,
    duration: d,
    ease: EASE,
    overwrite: 'auto',
  });
}

/** Short flare of light and a small swell when the world changes. */
export function firePulse(pulse: { v: number }) {
  if (prefersReducedMotion()) return;
  gsap
    .timeline({ overwrite: 'auto' })
    .to(pulse, { v: 1, duration: 0.3, ease: 'power2.out' })
    .to(pulse, { v: 0, duration: 1.2, ease: 'power2.inOut' });
}
