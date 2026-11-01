import type { WorldId } from './worlds';

export interface GalaxyObject {
  id: string;
  name: string;
  kind: string;
  /** Present when the object is one of the three visitable worlds */
  world?: WorldId;
  /** Orbit radius, starting angle, height above the disc */
  r: number;
  a0: number;
  y: number;
  size: number;
  color: string;
  sector: string;
  distance: string;
  readouts: [string, string][];
  desc: string;
  scan: string;
}

/** Same differential rotation as the galaxy shader, radians per second */
export const omega = (r: number) => 0.35 / (6 + r);

export const GALAXY_OBJECTS: GalaxyObject[] = [
  {
    id: 'verglas',
    name: 'Verglas',
    kind: 'Frozen world',
    world: 'frozen',
    r: 9.5,
    a0: 0.4,
    y: 0.6,
    size: 0.62,
    color: '#8fe6ff',
    sector: 'Sector 14 · 221.4 / 087.9',
    distance: '4.2 light years',
    readouts: [['Surface', '184 below zero'], ['Atmosphere', 'Thin nitrogen'], ['Signal', 'Faint, steady']],
    desc: 'A glass planet wrapped in ice that never melts. Something under the crust hums at a fixed pitch.',
    scan: 'Cracks in the ice repeat every 7.1 kilometres. Natural formations do not do that.',
  },
  {
    id: 'ignara',
    name: 'Ignara',
    kind: 'Fire world',
    world: 'fire',
    r: 15.5,
    a0: 2.35,
    y: -0.8,
    size: 0.7,
    color: '#ff7a3d',
    sector: 'Sector 19 · 340.2 / 112.6',
    distance: '9.8 light years',
    readouts: [['Surface', '1 240 degrees'], ['Atmosphere', 'Ash and sulphur'], ['Signal', 'Loud, erratic']],
    desc: 'A basalt shell split by rivers of molten rock. The night side glows brighter than the day side.',
    scan: 'Lava channels form a closed network. The flow reverses direction every nine minutes.',
  },
  {
    id: 'lumeth',
    name: 'Lumeth',
    kind: 'Bioluminescent world',
    world: 'bio',
    r: 21.5,
    a0: 4.35,
    y: 0.9,
    size: 0.66,
    color: '#38f0c8',
    sector: 'Sector 23 · 418.9 / 276.3',
    distance: '14.1 light years',
    readouts: [['Surface', '21 degrees'], ['Atmosphere', 'Humid, breathable'], ['Signal', 'Pulsing, rhythmic']],
    desc: 'Dark oceans and forests that light up in slow waves. The glow answers when something moves nearby.',
    scan: 'Light pulses travel across the surface in sequence, like a message passed hand to hand.',
  },
  {
    id: 'halcyon',
    name: 'Halcyon Gate',
    kind: 'Dormant jump gate',
    r: 6.2,
    a0: 3.5,
    y: 0.3,
    size: 0.48,
    color: '#b9a4ff',
    sector: 'Sector 11 · 106.8 / 301.0',
    distance: '2.6 light years',
    readouts: [['Structure', 'Ring, 4 km'], ['Power', 'Standby'], ['Origin', 'Unknown']],
    desc: 'A ring of dark metal left drifting in the dust. It is cold, but not dead.',
    scan: 'The gate drew power for exactly one second while the scan was running. Then it went quiet again.',
  },
  {
    id: 'vael',
    name: 'Vael Pulsar',
    kind: 'Pulsar',
    r: 12.2,
    a0: 5.4,
    y: -0.4,
    size: 0.5,
    color: '#ffffff',
    sector: 'Sector 17 · 288.5 / 044.7',
    distance: '7.3 light years',
    readouts: [['Period', '1.337 seconds'], ['Beam', 'Cyan, narrow'], ['Drift', 'Slowing']],
    desc: 'A collapsed star sweeping the arm with a thin beam, once every second and a bit.',
    scan: 'The pulse timing carries a slow modulation. Eleven minutes of listening revealed a pattern.',
  },
  {
    id: 'ossuary',
    name: 'Ossuary Drift',
    kind: 'Debris field',
    r: 18,
    a0: 1.1,
    y: 0.2,
    size: 0.55,
    color: '#9db4d8',
    sector: 'Sector 21 · 372.1 / 190.4',
    distance: '11.5 light years',
    readouts: [['Fragments', '40 000 plus'], ['Age', 'Over 2 million years'], ['Hull marks', 'None found']],
    desc: 'The remains of something very large, spread thin across a million kilometres of dark.',
    scan: 'Every fragment is cut with the same clean angle. Whatever this was, it was taken apart on purpose.',
  },
  {
    id: 'thessaly',
    name: 'Thessaly Rift',
    kind: 'Spatial rift',
    r: 24.5,
    a0: 0.0,
    y: -0.6,
    size: 0.6,
    color: '#7356d9',
    sector: 'Sector 26 · 455.0 / 019.2',
    distance: '16.7 light years',
    readouts: [['Width', '0.4 light seconds'], ['Light', 'Bends inward'], ['Stability', 'Unclear']],
    desc: 'A seam in space. Starlight bends toward it and does not come back out.',
    scan: 'Light entering the rift arrives at the far side before it left. The instruments were rechecked twice.',
  },
  {
    id: 'orrin',
    name: 'Orrin’s Eye',
    kind: 'Red giant',
    r: 27.5,
    a0: 2.9,
    y: 0.7,
    size: 0.78,
    color: '#ff6f6f',
    sector: 'Sector 28 · 503.7 / 238.8',
    distance: '19.4 light years',
    readouts: [['Radius', '700 suns'], ['Age', 'Last stage'], ['Planets', 'Seven, all dark']],
    desc: 'A dying star swollen to the size of an orbit. Seven planets circle it in the dark, unlit and silent.',
    scan: 'One of the seven planets shows a single steady light on its night side.',
  },
];

export const GALAXY_OBJECT_COUNT = GALAXY_OBJECTS.length;
