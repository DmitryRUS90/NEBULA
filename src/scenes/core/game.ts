import { audio } from '../../core/audio';
import { useStore } from '../../core/store';
import { clamp, lerp } from '../../core/util';

/**
 * Energy core game state and simulation.
 * Everything here is plain mutable data stepped from one requestAnimationFrame loop.
 * React only hears about phase changes through `subscribe`, never per frame.
 */

export type Phase = 'intro' | 'countdown' | 'playing' | 'won' | 'lost';

export const FLOW_COUNT = 3;
export const TIME_LIMIT = 55;
const COUNTDOWN = 3;
/** Share of the round over which the difficulty ramps up, in seconds */
const RAMP_SECONDS = 40;
const FILL_RATE = 5;
const DRAIN_RATE = 1.6;
const KEY_SPEED = 0.55;

export const FLOW_DEFS = [
  { id: 'alpha', name: 'Alpha', color: '#27D8F2' },
  { id: 'beta', name: 'Beta', color: '#9a82ff' },
  { id: 'gamma', name: 'Gamma', color: '#38f0c8' },
] as const;

export interface FlowState {
  /** What the player sets, 0..1 */
  valve: number;
  /** What the core actually receives, 0..1 */
  level: number;
  /** Slow drift added on top of the valve, plus a decaying surge */
  offset: number;
  surge: number;
  /** Safe window: centre and half width, 0..1 */
  center: number;
  half: number;
  inBand: boolean;
  /** Smoothed 0..1 out of band amount for visuals */
  off: number;
  w1: number;
  w2: number;
  p1: number;
  p2: number;
  cw: number;
  cp: number;
  nextSurge: number;
}

const makeFlow = (): FlowState => ({
  valve: 0.5,
  level: 0.5,
  offset: 0,
  surge: 0,
  center: 0.5,
  half: 0.14,
  inBand: true,
  off: 0,
  w1: 0.7,
  w2: 1.4,
  p1: 0,
  p2: 0,
  cw: 0.25,
  cp: 0,
  nextSurge: 6,
});

export const game = {
  phase: 'intro' as Phase,
  paused: false,
  /** Wall clock for idle animation */
  clock: 0,
  /** Round time in seconds */
  t: 0,
  countT: COUNTDOWN,
  count: COUNTDOWN,
  stability: 0,
  instability: 0,
  /** Highest instability reached this round */
  peak: 0,
  /** Seconds since the round ended */
  since: 0,
  /** Eased copies for the 3D layer, 0..1 */
  stabVis: 0.3,
  instVis: 0.1,
  selected: 0,
  keyDir: 0 as number,
  flows: [makeFlow(), makeFlow(), makeFlow()] as FlowState[],
  loseReason: '',
  result: { time: 0, integrity: 0 },
  alertMid: false,
  alertHigh: false,
};

const listeners = new Set<() => void>();
export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const emit = () => listeners.forEach((fn) => fn());

/** Pushes a change to the interface when something other than the loop changes the state */
export const notify = emit;

function shape(f: FlowState, t: number) {
  const ramp = clamp(t / RAMP_SECONDS, 0, 1);
  f.half = lerp(0.15, 0.09, ramp);
  f.center = 0.5 + 0.26 * Math.sin(t * f.cw + f.cp);
  const amp = lerp(0.12, 0.24, ramp);
  f.offset = (amp * (Math.sin(t * f.w1 + f.p1) + 0.5 * Math.sin(t * f.w2 + f.p2))) / 1.5;
  return ramp;
}

function prepareFlows() {
  for (const f of game.flows) {
    f.w1 = 0.5 + Math.random() * 0.4;
    f.w2 = 1.1 + Math.random() * 0.6;
    f.p1 = Math.random() * Math.PI * 2;
    f.p2 = Math.random() * Math.PI * 2;
    f.cw = 0.16 + Math.random() * 0.14;
    f.cp = Math.random() * Math.PI * 2;
    f.nextSurge = 6 + Math.random() * 3;
    f.surge = 0;
    shape(f, 0);
    // the round opens with every flow already inside its band
    f.valve = clamp(f.center - f.offset, 0, 1);
    f.level = f.center;
    f.inBand = true;
    f.off = 0;
  }
}

export function resetToIntro() {
  game.phase = 'intro';
  game.paused = false;
  game.t = 0;
  game.stability = 0;
  game.instability = 0;
  game.peak = 0;
  game.since = 0;
  game.stabVis = 0.3;
  game.instVis = 0.1;
  game.keyDir = 0;
  game.selected = 0;
  game.count = COUNTDOWN;
  game.countT = COUNTDOWN;
  game.alertMid = false;
  game.alertHigh = false;
  for (const f of game.flows) {
    f.center = 0.5;
    f.half = 0.14;
    f.level = 0.5;
    f.off = 0;
    f.inBand = true;
  }
  emit();
}

export function startRound() {
  prepareFlows();
  game.phase = 'countdown';
  game.paused = false;
  game.t = 0;
  game.stability = 0;
  game.instability = 0;
  game.peak = 0;
  game.since = 0;
  game.keyDir = 0;
  game.selected = 0;
  game.countT = COUNTDOWN;
  game.count = COUNTDOWN;
  game.alertMid = false;
  game.alertHigh = false;
  game.loseReason = '';
  useStore.getState().addCoreAttempt();
  audio.play('tick');
  emit();
}

export function setValve(i: number, v: number) {
  game.flows[i].valve = clamp(v, 0, 1);
}

export function selectFlow(i: number) {
  if (game.selected !== i) {
    game.selected = i;
    emit();
  }
}

export const isLive = () => game.phase === 'countdown' || game.phase === 'playing';

function finish(won: boolean, reason: string) {
  game.phase = won ? 'won' : 'lost';
  game.since = 0;
  game.keyDir = 0;
  game.loseReason = reason;
  const integrity = won ? Math.round(clamp(100 - game.peak, 0, 100)) : 0;
  game.result = { time: game.t, integrity };
  useStore.getState().finishCore({ won, time: Math.round(game.t * 10) / 10, integrity });
  audio.play(won ? 'success' : 'fail');
  emit();
}

function stepPlaying(dt: number) {
  game.t += dt;
  const t = game.t;
  let off = 0;
  for (let i = 0; i < FLOW_COUNT; i++) {
    const f = game.flows[i];
    const ramp = shape(f, t);
    if (t >= f.nextSurge) {
      f.surge = (Math.random() < 0.5 ? -1 : 1) * lerp(0.15, 0.25, ramp);
      f.nextSurge = t + lerp(8, 4.5, ramp) + Math.random() * 3;
    }
    f.surge *= Math.exp(-dt * 1.4);
    if (i === game.selected && game.keyDir !== 0) f.valve = clamp(f.valve + game.keyDir * KEY_SPEED * dt, 0, 1);
    const target = clamp(f.valve + f.offset + f.surge, 0, 1);
    f.level += (target - f.level) * (1 - Math.exp(-dt * 8));
    f.inBand = Math.abs(f.level - f.center) <= f.half;
    if (!f.inBand) off++;
  }

  const ramp = clamp(t / RAMP_SECONDS, 0, 1);
  if (off === 0) {
    game.stability = Math.min(100, game.stability + FILL_RATE * dt);
    game.instability = Math.max(0, game.instability - 10 * dt);
  } else {
    game.stability = Math.max(0, game.stability - DRAIN_RATE * dt);
    game.instability = Math.min(100, game.instability + (4 + off * 4.5) * (1 + ramp * 0.4) * dt);
  }
  if (game.instability > game.peak) game.peak = game.instability;

  if (game.instability >= 50 && !game.alertMid) {
    game.alertMid = true;
    audio.play('alert');
  } else if (game.instability >= 80 && !game.alertHigh) {
    game.alertHigh = true;
    audio.play('alert');
  }
  if (game.instability < 30) {
    game.alertMid = false;
    game.alertHigh = false;
  }

  if (game.stability >= 100) finish(true, '');
  else if (game.instability >= 100) finish(false, 'Instability reached the limit and the containment field failed.');
  else if (t >= TIME_LIMIT) finish(false, 'Time ran out before the core settled.');
}

/** One simulation step. Call every frame with the frame time in seconds. */
export function step(dt: number) {
  if (game.paused) return;
  game.clock += dt;
  const ease = 1 - Math.exp(-dt * 4);
  let instTarget = 0;
  let stabTarget = 0;

  switch (game.phase) {
    case 'intro': {
      for (let i = 0; i < FLOW_COUNT; i++) {
        const f = game.flows[i];
        f.level = 0.5 + 0.08 * Math.sin(game.clock * 0.8 + i * 2.1);
        f.off = 0;
      }
      instTarget = 0.16 + 0.07 * Math.sin(game.clock * 0.9);
      stabTarget = 0.35;
      break;
    }
    case 'countdown': {
      game.countT -= dt;
      const c = Math.max(0, Math.ceil(game.countT));
      if (c !== game.count) {
        game.count = c;
        if (c > 0) audio.play('tick');
        emit();
      }
      if (game.countT <= 0) {
        game.phase = 'playing';
        audio.play('on');
        emit();
      }
      instTarget = 0;
      stabTarget = 0.1;
      break;
    }
    case 'playing': {
      stepPlaying(dt);
      instTarget = game.instability / 100;
      stabTarget = game.stability / 100;
      break;
    }
    case 'won':
    case 'lost': {
      game.since += dt;
      const won = game.phase === 'won';
      const k = 1 - Math.exp(-dt * 2);
      for (const f of game.flows) {
        f.level += ((won ? f.center : 0.05) - f.level) * k;
        f.off += ((won ? 0 : 1) - f.off) * (1 - Math.exp(-dt * 3));
      }
      instTarget = won ? 0 : 1;
      stabTarget = won ? 1 : 0;
      break;
    }
  }

  if (game.phase === 'playing' || game.phase === 'countdown') {
    for (const f of game.flows) f.off += ((f.inBand ? 0 : 1) - f.off) * (1 - Math.exp(-dt * 6));
  }
  game.instVis += (instTarget - game.instVis) * ease;
  game.stabVis += (stabTarget - game.stabVis) * ease;
}

// dev only: lets the browser tests read the state and run the simulation faster than real time
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __core?: unknown }).__core = { game, step, startRound, resetToIntro, setValve };
}
