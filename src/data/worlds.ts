export type WorldId = 'frozen' | 'fire' | 'bio';

export interface WorldDef {
  id: WorldId;
  name: string;
  designation: string;
  klass: string;
  accent: string;
  tint: [string, string, string];
  desc: string;
  log: string;
  /** Four bars: label, value text, fill 0..1 */
  metrics: { label: string; value: string; fill: number }[];
  /** Shader and particle parameters, tweened between worlds */
  look: {
    colA: string;
    colB: string;
    vein: string;
    atmo: string;
    veinAmt: number;
    veinScale: number;
    spotAmt: number;
    spotScale: number;
    gloss: number;
    hot: number;
    atmoPow: number;
    atmoAmt: number;
    ring: number;
    light: [number, number, number];
    weather: { vel: [number, number, number]; sway: number; color: string; size: number; alpha: number };
  };
}

export const WORLD_ORDER: WorldId[] = ['frozen', 'fire', 'bio'];

export const WORLDS: Record<WorldId, WorldDef> = {
  frozen: {
    id: 'frozen',
    name: 'Frozen World',
    designation: 'Verglas',
    klass: 'Cryo planet',
    accent: '#8fe6ff',
    tint: ['#10294d', '#4a6fd0', '#8fe6ff'],
    desc: 'Ice a hundred kilometres deep, cracked in perfect lines. Snow falls upward when the wind turns, and the crust hums a single note.',
    log: 'Landing party advised to keep radio silence below the ice line.',
    metrics: [
      { label: 'Surface', value: '184 below zero', fill: 0.14 },
      { label: 'Atmosphere', value: 'Thin nitrogen', fill: 0.3 },
      { label: 'Gravity', value: '0.8 g', fill: 0.42 },
      { label: 'Hazard', value: 'Moderate', fill: 0.5 },
    ],
    look: {
      colA: '#9ccfff',
      colB: '#f1fbff',
      vein: '#27D8F2',
      atmo: '#7fd8ff',
      veinAmt: 0.55,
      veinScale: 3.4,
      spotAmt: 0,
      spotScale: 4,
      gloss: 1.1,
      hot: 0,
      atmoPow: 3.2,
      atmoAmt: 1.0,
      ring: 1,
      light: [1.0, 0.45, 0.8],
      weather: { vel: [0.15, -0.9, 0.05], sway: 0.5, color: '#eaf8ff', size: 2.2, alpha: 0.85 },
    },
  },
  fire: {
    id: 'fire',
    name: 'Fire World',
    designation: 'Ignara',
    klass: 'Volcanic planet',
    accent: '#ff7a3d',
    tint: ['#2a0f18', '#a3392f', '#ff9a4d'],
    desc: 'A black crust split by rivers of molten rock. The night side glows brighter than the day side, and the ground never stops moving.',
    log: 'Thermal shielding must hold above 1 300 degrees. Do not land near the channels.',
    metrics: [
      { label: 'Surface', value: '1 240 degrees', fill: 0.94 },
      { label: 'Atmosphere', value: 'Ash and sulphur', fill: 0.78 },
      { label: 'Gravity', value: '1.3 g', fill: 0.64 },
      { label: 'Hazard', value: 'Extreme', fill: 0.96 },
    ],
    look: {
      colA: '#130808',
      colB: '#34130f',
      vein: '#ff6a1f',
      atmo: '#ff6b3a',
      veinAmt: 1.15,
      veinScale: 2.6,
      spotAmt: 0,
      spotScale: 4,
      gloss: 0.05,
      hot: 0.9,
      atmoPow: 2.6,
      atmoAmt: 1.0,
      ring: 0,
      light: [-0.9, 0.35, 0.9],
      weather: { vel: [0.05, 0.75, 0.1], sway: 0.7, color: '#ffb066', size: 2.6, alpha: 0.95 },
    },
  },
  bio: {
    id: 'bio',
    name: 'Bioluminescent World',
    designation: 'Lumeth',
    klass: 'Living planet',
    accent: '#38f0c8',
    tint: ['#0a1d3f', '#2b6bb0', '#38f0c8'],
    desc: 'Dark oceans and forests that light up in slow waves. The glow answers when something moves nearby, as if the whole planet were listening.',
    log: 'Surface lights respond to sound. Keep engines at minimum on approach.',
    metrics: [
      { label: 'Surface', value: '21 degrees', fill: 0.52 },
      { label: 'Atmosphere', value: 'Humid, breathable', fill: 0.7 },
      { label: 'Gravity', value: '0.95 g', fill: 0.5 },
      { label: 'Hazard', value: 'Unknown', fill: 0.34 },
    ],
    look: {
      colA: '#0a1236',
      colB: '#123a5c',
      vein: '#38f0c8',
      atmo: '#3fe6d0',
      veinAmt: 0.4,
      veinScale: 3.0,
      spotAmt: 1.0,
      spotScale: 4.2,
      gloss: 0.15,
      hot: 0,
      atmoPow: 3.0,
      atmoAmt: 0.95,
      ring: 0,
      light: [0.7, 0.55, 1.0],
      weather: { vel: [0.08, 0.12, 0.05], sway: 1.1, color: '#6bffe0', size: 3.0, alpha: 0.9 },
    },
  },
};
