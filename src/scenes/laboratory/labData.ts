import type { LabMode } from '../../core/store';

export interface NodeDef {
  name: string;
  hint: string;
  color: string;
  /** Direction from the core, in the artifact's own space */
  dir: [number, number, number];
}

export const NODE_RADIUS = 2.9;

export const NODES: NodeDef[] = [
  { name: 'Anchor', hint: 'Grounds the core', color: '#27D8F2', dir: [1, 1, 1] },
  { name: 'Prism', hint: 'Splits the light', color: '#9a82ff', dir: [1, -1, -1] },
  { name: 'Relay', hint: 'Carries the pulse', color: '#38f0c8', dir: [-1, 1, -1] },
  { name: 'Seed', hint: 'Wakes the lattice', color: '#ffb35c', dir: [-1, -1, 1] },
];

export const MODES: { id: LabMode; label: string; note: string }[] = [
  { id: 'spectral', label: 'Spectral', note: 'Light splits into colour bands across the shell.' },
  { id: 'thermal', label: 'Thermal', note: 'Heat maps the shell from deep violet to white.' },
  { id: 'structure', label: 'Structure', note: 'The frame and its anchor points show how the lattice is built.' },
  { id: 'field', label: 'Field', note: 'Field lines and drifting particles show where the energy flows.' },
];

export interface Readouts {
  /** Terawatts */
  output: number;
  /** Percent */
  stability: number;
  /** Hertz */
  frequency: number;
  /** Degrees, meaningless once locked */
  phase: number;
  locked: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const OUTPUT_MAX = 16.5;
export const FREQ_MAX = 40;

/** Everything the readouts show comes from the real state of the chamber. */
export function computeReadouts(mode: LabMode, nodeCount: number, scale: number): Readouts {
  const idx = MODES.findIndex((m) => m.id === mode);
  const modeGain = mode === 'thermal' ? 1.15 : mode === 'structure' ? 0.85 : mode === 'field' ? 1.3 : 1;
  const output = (1.2 + 2.4 * nodeCount + (scale - 1) * 1.8) * modeGain;
  const stability = clamp(38 + nodeCount * 14 - Math.abs(scale - 1) * 12 + (mode === 'structure' ? 8 : 0), 4, 99.4);
  const freqShift = mode === 'field' ? 1.12 : mode === 'thermal' ? 0.94 : 1;
  const frequency = ((7.83 * (1 + 0.5 * nodeCount)) / Math.sqrt(scale)) * freqShift;
  const phase = (nodeCount * 47.3 + idx * 13.7 + scale * 10) % 360;
  return { output, stability, frequency, phase, locked: nodeCount === 4 };
}
