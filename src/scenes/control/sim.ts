import type { SwitchKey, SystemKey } from '../../core/store';
import { clamp } from '../../core/util';

export const TAU = Math.PI * 2;
/** Total power the reactor can feed to the four systems */
export const BUDGET = 240;
/** Contacts farther than this (share of full radar radius) need deep scan */
export const FAR = 0.7;
export const WARN_TEMP = 85;
export const CUTOFF_TEMP = 98;

export const SYSTEMS: { key: SystemKey; label: string; hint: string }[] = [
  { key: 'engines', label: 'Engines', hint: 'Thrust and star drift' },
  { key: 'shields', label: 'Shields', hint: 'Hull screen strength' },
  { key: 'sensors', label: 'Sensors', hint: 'Radar reach' },
  { key: 'life', label: 'Life support', hint: 'Air and warmth for the crew' },
];

export const SWITCHES: { key: SwitchKey; label: string; hint: string; on: string; off: string }[] = [
  {
    key: 'stealth',
    label: 'Stealth mode',
    hint: 'Cuts signal strength by 35 and slows the drift. Adds heat.',
    on: 'Stealth mode on. Signal strength dropped and the drift slowed.',
    off: 'Stealth mode off. The ship is visible again.',
  },
  {
    key: 'stabilizers',
    label: 'Stabilizers',
    hint: 'Cool the reactor by 16 degrees. Take 6 percent of engine output.',
    on: 'Stabilizers on. The reactor is cooling.',
    off: 'Stabilizers off. The reactor will run hotter.',
  },
  {
    key: 'deepScan',
    label: 'Deep scan',
    hint: 'Extends radar reach and reveals far contacts. Adds heat.',
    on: 'Deep scan on. Far contacts are now in reach.',
    off: 'Deep scan off. Radar reach is back to normal.',
  },
  {
    key: 'beacon',
    label: 'Beacon',
    hint: 'Broadcasts your position. Raises signal strength. Adds heat.',
    on: 'Beacon on. The ship is broadcasting its position.',
    off: 'Beacon off. The ship is quiet again.',
  },
];

export type ContactTone = 'info' | 'warn' | 'violet';

export interface Contact {
  id: string;
  name: string;
  kind: string;
  /** Distance as a share of full radar radius, 0..1 */
  r: number;
  /** Starting bearing and angular speed, radians and radians per second */
  a0: number;
  speed: number;
  size: number;
  tone: ContactTone;
  desc: string;
}

export const CONTACTS: Contact[] = [
  { id: 'c-debris', name: 'Drifting debris', kind: 'Wreckage', r: 0.2, a0: 0.6, speed: 0.05, size: 3, tone: 'info', desc: 'A torn hull plate, fourteen metres across, tumbling end over end.' },
  { id: 'c-beacon', name: 'Signal beacon', kind: 'Automated beacon', r: 0.3, a0: 2.1, speed: -0.04, size: 3.5, tone: 'violet', desc: 'An automated beacon repeating a three tone sequence. Nobody has answered it in a long time.' },
  { id: 'c-vessel', name: 'Unknown vessel', kind: 'Vessel', r: 0.38, a0: 4.0, speed: 0.07, size: 4, tone: 'warn', desc: 'Cold hull, no transponder. It has matched our speed since the last sweep.' },
  { id: 'c-ice', name: 'Ice fragment', kind: 'Natural body', r: 0.47, a0: 5.3, speed: 0.03, size: 3, tone: 'info', desc: 'A shard of old ice carrying traces of an atmosphere that no nearby planet has.' },
  { id: 'c-relay', name: 'Relay buoy', kind: 'Communications relay', r: 0.55, a0: 1.2, speed: -0.05, size: 3.5, tone: 'violet', desc: 'A communications relay with its dish pointed at the galactic core.' },
  { id: 'c-drone', name: 'Survey drone', kind: 'Drone', r: 0.62, a0: 3.3, speed: 0.06, size: 3, tone: 'info', desc: 'A small drone still logging readings. Its last upload is eleven years old.' },
  { id: 'c-anomaly', name: 'Magnetic anomaly', kind: 'Field anomaly', r: 0.76, a0: 0.1, speed: -0.025, size: 4.5, tone: 'violet', desc: 'A knot of field lines that bends compasses and sensor readings alike.' },
  { id: 'c-station', name: 'Dormant station', kind: 'Station', r: 0.85, a0: 2.8, speed: 0.02, size: 5, tone: 'warn', desc: 'A station with every light out. One airlock cycle was logged during the scan.' },
  { id: 'c-hauler', name: 'Derelict hauler', kind: 'Wreckage', r: 0.93, a0: 4.7, speed: -0.015, size: 4.5, tone: 'info', desc: 'A bulk hauler split along its spine. The cargo bays are empty and the doors are open.' },
];

export const contactIndex = (id: string) => CONTACTS.findIndex((c) => c.id === id);
export const contactDistance = (c: Contact) => `${Math.round(c.r * 4800)} km`;

/** Radar reach as a share of full radius */
export const rangeOf = (sensors: number, deepScan: boolean) => Math.min(1, 0.34 + sensors * 0.0046 + (deepScan ? 0.22 : 0));

export const isDetected = (c: Contact, range: number, deepScan: boolean) => c.r <= range && (c.r < FAR || deepScan);

/**
 * Sets one system and draws the others down proportionally when the shared budget is exceeded.
 * Returns whole numbers.
 */
export function applyPower(key: SystemKey, value: number, power: Record<SystemKey, number>): Record<SystemKey, number> {
  const keys = Object.keys(power) as SystemKey[];
  const next = { ...power, [key]: Math.round(clamp(value, 0, 100)) };
  const total = keys.reduce((n, k) => n + next[k], 0);
  if (total <= BUDGET) return next;
  const others = keys.filter((k) => k !== key);
  const othersSum = others.reduce((n, k) => n + next[k], 0);
  const keep = Math.max(0, BUDGET - next[key]);
  const f = othersSum > 0 ? keep / othersSum : 0;
  others.forEach((k) => {
    next[k] = Math.floor(next[k] * f);
  });
  return next;
}

export const totalPower = (p: Record<SystemKey, number>) => p.engines + p.shields + p.sensors + p.life;

/** The temperature the reactor is heading for with the current settings */
export function reactorTarget(p: Record<SystemKey, number>, sw: Record<SwitchKey, boolean>) {
  return (
    18 +
    (totalPower(p) / BUDGET) * 42 +
    (sw.stealth ? 5 : 0) +
    (sw.deepScan ? 9 : 0) +
    (sw.beacon ? 6 : 0) +
    Math.max(0, p.engines - 60) * 0.35 +
    Math.max(0, p.shields - 60) * 0.2 -
    (sw.stabilizers ? 16 : 0)
  );
}

export interface Diagnostics {
  hull: number;
  shield: number;
  engine: number;
  signal: number;
  life: number;
}

export function diagnostics(p: Record<SystemKey, number>, sw: Record<SwitchKey, boolean>, temp: number): Diagnostics {
  return {
    hull: Math.round(clamp(100 - Math.max(0, temp - 80) * 2.5, 0, 100)),
    shield: Math.round(p.shields * (sw.stealth ? 0.9 : 1)),
    engine: Math.round(p.engines * (sw.stabilizers ? 0.94 : 1)),
    signal: Math.round(clamp(30 + p.sensors * 0.2 + (sw.beacon ? 40 : 0) + (sw.deepScan ? 8 : 0) - (sw.stealth ? 35 : 0), 0, 100)),
    life: p.life,
  };
}

export const lifeStatus = (v: number) => (v < 25 ? 'Critical' : v < 45 ? 'Low' : 'Steady');
export const signalStatus = (v: number) => (v < 30 ? 'Hard to detect' : v < 60 ? 'Visible up close' : 'Visible from far away');
export const tempStatus = (t: number) => (t >= CUTOFF_TEMP ? 'Critical' : t >= WARN_TEMP ? 'Warning' : t >= 65 ? 'Warm' : 'Stable');
