import { useMemo } from 'react';
import { Atom, Compass, Flask, MapTrifold, Planet, Wrench, type Icon } from '@phosphor-icons/react';
import { explorationIndex, useStore } from '../../core/store';
import type { SceneId } from '../../core/scenes';
import { GALAXY_OBJECTS } from '../../data/galaxy';
import { fmtTime } from '../../core/util';

const OBJECTS = GALAXY_OBJECTS.length;
const SHIP_CONTROLS = 10;

type Snapshot = ReturnType<typeof useStore.getState>;

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: Icon;
  earned: boolean;
  missing: string;
}

export interface Remaining {
  scene: SceneId;
  name: string;
  /** Share of this scene still open, 0..1 */
  open: number;
  detail: string;
}

export interface CoreSummary {
  state: 'won' | 'failed' | 'none';
  value: string;
  sub: string;
}

export interface Results {
  index: number;
  scanned: number;
  worlds: number;
  labModes: number;
  labNodes: number;
  controls: number;
  identified: number;
  pings: number;
  core: CoreSummary;
  achievements: Achievement[];
  remaining: Remaining[];
  next: Remaining | null;
  nothing: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function summarizeCore(s: Snapshot): CoreSummary {
  if (s.coreBest?.won) {
    const raw = s.coreBest.integrity;
    const pct = Math.round(raw <= 1 ? raw * 100 : raw);
    return { state: 'won', value: `Stabilized in ${fmtTime(s.coreBest.time)}`, sub: `Integrity ${pct} percent` };
  }
  if (s.coreAttempts > 0 || s.coreResult) {
    const tries = Math.max(1, s.coreAttempts);
    return { state: 'failed', value: 'Not stabilized', sub: plural(tries, 'attempt', 'attempts') };
  }
  return { state: 'none', value: 'Not attempted', sub: 'The core is still unstable' };
}

export function compute(s: Snapshot): Results {
  const scanned = s.scanned.length;
  const worlds = s.worldsVisited.length;
  const labModes = s.labModes.length;
  const labNodes = s.labNodes.length;
  const controls = Math.min(SHIP_CONTROLS, s.touched.length);
  const won = !!s.coreBest?.won;

  const achievements: Achievement[] = [
    {
      id: 'cartographer',
      title: 'Cartographer',
      desc: 'Scanned every object on the galaxy map.',
      icon: MapTrifold,
      earned: scanned >= OBJECTS,
      missing: `Scan ${plural(OBJECTS - scanned, 'more object', 'more objects')} on the galaxy map.`,
    },
    {
      id: 'worldwalker',
      title: 'Worldwalker',
      desc: 'Visited the frozen, fire and living worlds.',
      icon: Planet,
      earned: worlds >= 3,
      missing: `Visit ${plural(3 - worlds, 'more world', 'more worlds')}.`,
    },
    {
      id: 'analyst',
      title: 'Analyst',
      desc: 'Tried all four visualization modes.',
      icon: Flask,
      earned: labModes >= 4,
      missing: `Try ${plural(4 - labModes, 'more mode', 'more modes')} in the laboratory.`,
    },
    {
      id: 'resonance',
      title: 'Resonance',
      desc: 'Activated all four laboratory nodes.',
      icon: Atom,
      earned: labNodes >= 4,
      missing: `Activate ${plural(4 - labNodes, 'more node', 'more nodes')} in the laboratory.`,
    },
    {
      id: 'engineer',
      title: 'Engineer',
      desc: 'Used ten ship controls.',
      icon: Wrench,
      earned: controls >= SHIP_CONTROLS,
      missing: `Use ${plural(SHIP_CONTROLS - controls, 'more control', 'more controls')} in the control center.`,
    },
    {
      id: 'stabilizer',
      title: 'Stabilizer',
      desc: 'Brought the energy core to a stable state.',
      icon: Compass,
      earned: won,
      missing: s.coreAttempts > 0 ? 'The core did not hold. Try the stabilization again.' : 'Stabilize the energy core.',
    },
  ];

  const labOpen = 1 - (labModes / 4 + labNodes / 4) / 2;
  const all: Remaining[] = [
    {
      scene: 'galaxy',
      name: 'Galaxy map',
      open: 1 - scanned / OBJECTS,
      detail: `${OBJECTS - scanned} of ${OBJECTS} objects are still unscanned.`,
    },
    {
      scene: 'worlds',
      name: 'Worlds',
      open: 1 - worlds / 3,
      detail: `${3 - worlds} of 3 worlds have not been visited.`,
    },
    {
      scene: 'laboratory',
      name: 'Laboratory',
      open: labOpen,
      detail: `${4 - labModes} modes and ${4 - labNodes} nodes are still untouched.`,
    },
    {
      scene: 'control',
      name: 'Control center',
      open: 1 - controls / SHIP_CONTROLS,
      detail: `${SHIP_CONTROLS - controls} of ${SHIP_CONTROLS} ship controls have not been used.`,
    },
    {
      scene: 'core',
      name: 'Energy core',
      open: won ? 0 : 1,
      detail: s.coreAttempts > 0 ? 'The core has not been stabilized yet.' : 'The core has not been attempted.',
    },
  ];
  const remaining = all.filter((r) => r.open > 0.001);
  // the most unfinished scene first, earlier scenes win ties
  const next = remaining.reduce<Remaining | null>((best, r) => (!best || r.open > best.open + 0.001 ? r : best), null);

  const nothing =
    scanned === 0 && worlds === 0 && labNodes === 0 && labModes <= 1 && s.touched.length === 0 && s.coreAttempts === 0 && !s.coreBest;

  return {
    index: explorationIndex(s),
    scanned,
    worlds,
    labModes,
    labNodes,
    controls,
    identified: s.identified.length,
    pings: s.pings,
    core: summarizeCore(s),
    achievements,
    remaining,
    next,
    nothing,
  };
}

export function useResults(): Results {
  const s = useStore();
  return useMemo(() => compute(s), [s]);
}

export const TOTALS = { objects: OBJECTS, worlds: 3, modes: 4, nodes: 4, controls: SHIP_CONTROLS };
