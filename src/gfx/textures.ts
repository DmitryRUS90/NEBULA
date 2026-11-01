import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

let glow: CanvasTexture | null = null;

/** One shared radial glow texture for sprites and halos. */
export function getGlowTexture(): CanvasTexture {
  if (glow) return glow;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glow = new CanvasTexture(c);
  glow.colorSpace = SRGBColorSpace;
  glow.minFilter = LinearFilter;
  glow.magFilter = LinearFilter;
  glow.generateMipmaps = false;
  return glow;
}
