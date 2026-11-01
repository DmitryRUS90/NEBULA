import { prefersReducedMotion } from './util';

export type Tier = 'high' | 'balanced' | 'lite';

export interface TierConfig {
  dpr: [number, number];
  stars: number;
  galaxy: number;
  vortex: number;
  planetSeg: number;
  planetOct: number;
  labDetail: number;
  fieldPoints: number;
  nebulaSize: number;
  particles: number;
  aa: boolean;
}

export const TIERS: Record<Tier, TierConfig> = {
  high: { dpr: [1, 2], stars: 7000, galaxy: 48000, vortex: 11000, planetSeg: 96, planetOct: 5, labDetail: 36, fieldPoints: 2600, nebulaSize: 512, particles: 1800, aa: true },
  balanced: { dpr: [1, 1.5], stars: 3600, galaxy: 26000, vortex: 6000, planetSeg: 64, planetOct: 4, labDetail: 22, fieldPoints: 1400, nebulaSize: 384, particles: 1000, aa: true },
  lite: { dpr: [1, 1], stars: 1600, galaxy: 11000, vortex: 2800, planetSeg: 40, planetOct: 3, labDetail: 10, fieldPoints: 600, nebulaSize: 256, particles: 450, aa: false },
};

export const TIER_LABEL: Record<Tier, string> = { high: 'High', balanced: 'Balanced', lite: 'Lite' };

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function detectTier(): { tier: Tier; reason: string } {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const small = Math.min(window.screen.width, window.screen.height) < 700;

  let renderer = '';
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    /* ignore */
  }
  const software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);

  if (software) return { tier: 'lite', reason: 'software renderer' };
  if (prefersReducedMotion()) return { tier: 'lite', reason: 'reduced motion' };
  if (cores <= 2 || mem <= 2) return { tier: 'lite', reason: 'limited hardware' };
  if (coarse || small || cores <= 4 || mem <= 4) return { tier: 'balanced', reason: 'mobile or mid range device' };
  return { tier: 'high', reason: 'capable device' };
}

export const nextLowerTier = (t: Tier): Tier | null => (t === 'high' ? 'balanced' : t === 'balanced' ? 'lite' : null);
