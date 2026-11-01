import { create } from 'zustand';
import type { SceneId } from './scenes';
import type { WorldId } from '../data/worlds';
import { detectTier, type Tier } from './perf';
import { safeStorage } from './util';

export type LabMode = 'spectral' | 'thermal' | 'structure' | 'field';
export type QualityPref = 'auto' | Tier;
export type SystemKey = 'engines' | 'shields' | 'sensors' | 'life';
export type SwitchKey = 'stealth' | 'stabilizers' | 'deepScan' | 'beacon';

export interface LogEntry {
  id: number;
  t: number;
  text: string;
  tone: 'info' | 'warn' | 'ok';
}

export interface CoreResult {
  won: boolean;
  time: number;
  integrity: number;
}

const storage = safeStorage();
const initialTier = typeof window !== 'undefined' ? detectTier() : { tier: 'balanced' as Tier, reason: 'server' };
const savedQuality = storage.get('nebula.quality') as QualityPref | null;
const initialPref: QualityPref = savedQuality === 'high' || savedQuality === 'balanced' || savedQuality === 'lite' ? savedQuality : 'auto';
const savedSound = storage.get('nebula.sound');

let logId = 1;
let toastId = 1;

interface State {
  ready: boolean;
  scene: SceneId;
  pending: SceneId | null;
  transitioning: boolean;
  entered: boolean;
  portalOpening: boolean;
  startedAt: number;
  visited: SceneId[];

  // galaxy
  galaxySelected: string | null;
  scanned: string[];
  // worlds
  world: WorldId;
  worldsVisited: WorldId[];
  // laboratory
  labMode: LabMode;
  labModes: LabMode[];
  labNodes: number[];
  labScale: number;
  labSpin: boolean;
  // ship
  power: Record<SystemKey, number>;
  sw: Record<SwitchKey, boolean>;
  reactorTemp: number;
  log: LogEntry[];
  identified: string[];
  pings: number;
  touched: string[];
  // core
  coreResult: CoreResult | null;
  coreAttempts: number;
  coreBest: CoreResult | null;

  // settings
  sound: boolean;
  qualityPref: QualityPref;
  tier: Tier;
  tierReason: string;
  toast: { id: number; text: string; tone: 'info' | 'warn' } | null;

  setReady: () => void;
  beginTransition: (to: SceneId) => void;
  commitScene: (to: SceneId) => void;
  endTransition: () => void;
  setEntered: () => void;
  setPortalOpening: (v: boolean) => void;

  galaxySelect: (id: string | null) => void;
  scanObject: (id: string) => void;
  setWorld: (w: WorldId) => void;
  setLabMode: (m: LabMode) => void;
  toggleLabNode: (i: number) => void;
  setLabScale: (v: number) => void;
  setLabSpin: (v: boolean) => void;

  setPower: (k: SystemKey, v: number) => void;
  toggleSwitch: (k: SwitchKey) => void;
  setReactorTemp: (t: number) => void;
  addLog: (text: string, tone?: LogEntry['tone']) => void;
  identify: (id: string) => void;
  ping: () => void;
  emergencyCutoff: () => void;

  finishCore: (r: CoreResult) => void;
  addCoreAttempt: () => void;

  setSound: (on: boolean) => void;
  setQualityPref: (q: QualityPref) => void;
  setTier: (t: Tier, reason?: string) => void;
  showToast: (text: string, tone?: 'info' | 'warn') => void;
  clearToast: () => void;
  resetJourney: () => void;
}

const freshJourney = () => ({
  scene: 'portal' as SceneId,
  pending: null,
  transitioning: false,
  entered: false,
  portalOpening: false,
  startedAt: Date.now(),
  visited: ['portal'] as SceneId[],
  galaxySelected: null,
  scanned: [] as string[],
  world: 'frozen' as WorldId,
  worldsVisited: [] as WorldId[],
  labMode: 'spectral' as LabMode,
  labModes: ['spectral'] as LabMode[],
  labNodes: [] as number[],
  labScale: 1,
  labSpin: true,
  power: { engines: 60, shields: 60, sensors: 60, life: 50 } as Record<SystemKey, number>,
  sw: { stealth: false, stabilizers: false, deepScan: false, beacon: false } as Record<SwitchKey, boolean>,
  reactorTemp: 34,
  log: [{ id: logId++, t: 0, text: 'Ship systems online. Reactor stable.', tone: 'ok' as const }],
  identified: [] as string[],
  pings: 0,
  touched: [] as string[],
  coreResult: null as CoreResult | null,
  coreAttempts: 0,
  coreBest: null as CoreResult | null,
});

const uniq = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr : [...arr, v]);

export const useStore = create<State>((set, get) => ({
  ready: false,
  ...freshJourney(),
  sound: savedSound === null ? true : savedSound === '1',
  qualityPref: initialPref,
  tier: initialPref === 'auto' ? initialTier.tier : initialPref,
  tierReason: initialTier.reason,
  toast: null,

  setReady: () => set({ ready: true }),
  beginTransition: (to) => set({ pending: to, transitioning: true, galaxySelected: null }),
  commitScene: (to) =>
    set((s) => ({ scene: to, visited: uniq(s.visited, to), portalOpening: to === 'portal' ? false : s.portalOpening })),
  endTransition: () => set({ pending: null, transitioning: false }),
  setEntered: () => set({ entered: true }),
  setPortalOpening: (v) => set({ portalOpening: v }),

  galaxySelect: (id) => set({ galaxySelected: id }),
  scanObject: (id) => set((s) => ({ scanned: uniq(s.scanned, id) })),
  setWorld: (w) => set((s) => ({ world: w, worldsVisited: uniq(s.worldsVisited, w) })),
  setLabMode: (m) => set((s) => ({ labMode: m, labModes: uniq(s.labModes, m) })),
  toggleLabNode: (i) =>
    set((s) => ({ labNodes: s.labNodes.includes(i) ? s.labNodes.filter((n) => n !== i) : [...s.labNodes, i] })),
  setLabScale: (v) => set({ labScale: v }),
  setLabSpin: (v) => set({ labSpin: v }),

  setPower: (k, v) =>
    set((s) => ({ power: { ...s.power, [k]: v }, touched: uniq(s.touched, `power:${k}`) })),
  toggleSwitch: (k) =>
    set((s) => ({ sw: { ...s.sw, [k]: !s.sw[k] }, touched: uniq(s.touched, `switch:${k}`) })),
  setReactorTemp: (t) => set({ reactorTemp: t }),
  addLog: (text, tone = 'info') =>
    set((s) => ({
      log: [...s.log.slice(-39), { id: logId++, t: Math.round((Date.now() - s.startedAt) / 1000), text, tone }],
    })),
  identify: (id) => set((s) => ({ identified: uniq(s.identified, id), touched: uniq(s.touched, 'radar:identify') })),
  ping: () => set((s) => ({ pings: s.pings + 1, touched: uniq(s.touched, 'radar:ping') })),
  emergencyCutoff: () => set({ power: { engines: 50, shields: 50, sensors: 50, life: 50 }, reactorTemp: 60 }),

  finishCore: (r) =>
    set((s) => ({
      coreResult: r,
      coreBest: r.won && (!s.coreBest || r.time < s.coreBest.time) ? r : s.coreBest,
    })),
  addCoreAttempt: () => set((s) => ({ coreAttempts: s.coreAttempts + 1 })),

  setSound: (on) => {
    storage.set('nebula.sound', on ? '1' : '0');
    set({ sound: on });
  },
  setQualityPref: (q) => {
    storage.set('nebula.quality', q);
    if (q === 'auto') {
      const d = detectTier();
      set({ qualityPref: q, tier: d.tier, tierReason: d.reason });
    } else set({ qualityPref: q, tier: q, tierReason: 'chosen by you' });
  },
  setTier: (t, reason = 'performance') => set({ tier: t, tierReason: reason }),
  showToast: (text, tone = 'info') => set({ toast: { id: toastId++, text, tone } }),
  clearToast: () => set({ toast: null }),

  resetJourney: () => {
    set({ ...freshJourney() });
  },
}));

/** Share of the journey completed, 0..100, used on the final scene */
export function explorationIndex(s: State) {
  const galaxy = Math.min(1, s.scanned.length / 8);
  const worlds = s.worldsVisited.length / 3;
  const lab = Math.min(1, (s.labModes.length / 4 + s.labNodes.length / 4) / 2);
  const ship = Math.min(1, s.touched.length / 10);
  const core = s.coreBest?.won ? 1 : 0;
  return Math.round(((galaxy + worlds + lab + ship + core) / 5) * 100);
}
