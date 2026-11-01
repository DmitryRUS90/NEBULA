export type SceneId = 'portal' | 'galaxy' | 'worlds' | 'laboratory' | 'control' | 'core' | 'beyond';

export interface SceneDef {
  id: SceneId;
  n: string;
  name: string;
  sub: string;
  /** Nebula tint: deep, mid, bright */
  tint: [string, string, string];
  /** Background star drift, 0 is almost still */
  cruise: number;
  baseFov: number;
}

export const SCENES: SceneDef[] = [
  { id: 'portal', n: '01', name: 'Portal', sub: 'Entrance', tint: ['#182B55', '#7356D9', '#27D8F2'], cruise: 0.05, baseFov: 50 },
  { id: 'galaxy', n: '02', name: 'Galaxy map', sub: 'Exploration', tint: ['#182B55', '#7356D9', '#27D8F2'], cruise: 0.02, baseFov: 50 },
  { id: 'worlds', n: '03', name: 'Worlds', sub: 'Unknown planets', tint: ['#182B55', '#7356D9', '#27D8F2'], cruise: 0.02, baseFov: 42 },
  { id: 'laboratory', n: '04', name: 'Laboratory', sub: 'Research', tint: ['#10294d', '#5b3fc4', '#27D8F2'], cruise: 0.01, baseFov: 45 },
  { id: 'control', n: '05', name: 'Control center', sub: 'Ship systems', tint: ['#0f2347', '#3b4fb8', '#27D8F2'], cruise: 0.3, baseFov: 45 },
  { id: 'core', n: '06', name: 'Energy core', sub: 'Stabilization', tint: ['#1a1245', '#7356D9', '#27D8F2'], cruise: 0.03, baseFov: 45 },
  { id: 'beyond', n: '07', name: 'Beyond', sub: 'Final scene', tint: ['#1b2a60', '#8a6cf0', '#7ff0ff'], cruise: 0.06, baseFov: 50 },
];

export const sceneIndex = (id: SceneId) => SCENES.findIndex((s) => s.id === id);
export const sceneDef = (id: SceneId) => SCENES[sceneIndex(id)];
