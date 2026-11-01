import type { CoreResult, LabMode } from '../../core/store';
import { GALAXY_OBJECTS } from '../../data/galaxy';
import { WORLD_ORDER, WORLDS, type WorldId } from '../../data/worlds';

export const LAB_MODES: LabMode[] = ['spectral', 'thermal', 'structure', 'field'];
const MODE_COLOR: Record<LabMode, string> = {
  spectral: '#27D8F2',
  thermal: '#ff9a4d',
  structure: '#9a82ff',
  field: '#e8f6ff',
};

export type SlotKind = 'object' | 'world' | 'mode' | 'node' | 'core';

export interface Slot {
  id: string;
  kind: SlotKind;
  label: string;
  color: string;
  /** Marker radius in world units */
  size: number;
  x: number;
  y: number;
  z: number;
  found: boolean;
}

/** Outer radius of the whole composition, used to fit it to the screen. */
export const JOURNEY_RADIUS = 19.5;

interface Journey {
  scanned: string[];
  worldsVisited: WorldId[];
  labModes: LabMode[];
  labNodes: number[];
  coreBest: CoreResult | null;
}

/**
 * Every discoverable thing gets a fixed place around the gateway. Found things glow, missing things stay as outlines.
 * The order of the list is the order of the path that is drawn between found things.
 */
export function buildSlots(j: Journey): Slot[] {
  const slots: Slot[] = [];

  GALAXY_OBJECTS.forEach((o, i) => {
    const a = (i / GALAXY_OBJECTS.length) * Math.PI * 2 + 0.35;
    const r = 15.4 + (i % 2) * 2.3;
    slots.push({
      id: `object:${o.id}`,
      kind: 'object',
      label: o.name,
      color: o.color,
      size: 0.42 + o.size * 0.3,
      x: Math.cos(a) * r,
      y: Math.sin(a) * r * 0.78,
      z: Math.sin(i * 2.1) * 3,
      found: j.scanned.includes(o.id),
    });
  });

  WORLD_ORDER.forEach((w, k) => {
    const a = -Math.PI / 2 + (k * Math.PI * 2) / 3 + 0.2;
    slots.push({
      id: `world:${w}`,
      kind: 'world',
      label: WORLDS[w].name,
      color: WORLDS[w].accent,
      size: 0.95,
      x: Math.cos(a) * 12.8,
      y: Math.sin(a) * 12.8 * 0.8,
      z: 3.5,
      found: j.worldsVisited.includes(w),
    });
  });

  LAB_MODES.forEach((m, k) => {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    slots.push({
      id: `mode:${m}`,
      kind: 'mode',
      label: `Laboratory ${m}`,
      color: MODE_COLOR[m],
      size: 0.4,
      x: Math.cos(a) * 9.2,
      y: Math.sin(a) * 9.2 * 0.9,
      z: 2,
      found: j.labModes.includes(m),
    });
  });

  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    slots.push({
      id: `node:${k}`,
      kind: 'node',
      label: `Laboratory node ${k + 1}`,
      color: '#7ff0ff',
      size: 0.32,
      x: Math.cos(a) * 10.8,
      y: Math.sin(a) * 10.8 * 0.9,
      z: 1,
      found: j.labNodes.includes(k),
    });
  }

  slots.push({
    id: 'core',
    kind: 'core',
    label: 'Stabilized core',
    color: '#ffffff',
    size: 1.2,
    x: 0,
    y: 0,
    z: 4.5,
    found: !!j.coreBest?.won,
  });

  return slots;
}
