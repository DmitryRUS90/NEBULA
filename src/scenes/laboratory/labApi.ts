import { Color, SRGBColorSpace, Vector3, Vector4 } from 'three';

/**
 * Small bridge between the laboratory overlay and the 3D scene, in the same spirit as galaxyApi.
 * Nothing here goes through React: the scene reads these objects every frame.
 */
export const labApi = {
  /** Smoothly returns the artifact to its resting orientation */
  resetView: () => {},
  /** True while the mobile bottom sheet is expanded, the scene makes room for it */
  sheetOpen: false,
  /** Fires a pulse through the artifact. Direction in artifact space and a hex colour are optional. */
  pulse: (_dir?: [number, number, number], _color?: string) => {},
};

/** Shader uniforms shared by every laboratory material. GSAP tweens these directly. */
export function createUniforms() {
  return {
    uTime: { value: 0 },
    /** Mode weights: spectral, thermal, structure, field. They always sum to about one. */
    uW: { value: new Vector4(1, 0, 0, 0) },
    uNodes: { value: 0 },
    /** Resonance 0..1, reached when all four nodes are active */
    uRes: { value: 0 },
    /** Pulse progress 0..1, 1 means no pulse is travelling */
    uPulseT: { value: 1 },
    uPulseDir: { value: new Vector3(0, 1, 0) },
    uPulseCol: { value: new Vector3(1, 1, 1) },
    uEnergy: { value: 0.3 },
  };
}
export type LabUniforms = ReturnType<typeof createUniforms>;

/** Line and ring tint per mode, display space */
const TINT: [number, number, number][] = [
  [0.62, 0.5, 1.0],
  [1.0, 0.5, 0.18],
  [0.45, 0.65, 1.0],
  [0.2, 0.85, 1.0],
];

/** Writes the weighted mode tint into a colour without allocating. */
export function tintFor(out: Color, w: Vector4) {
  const r = TINT[0][0] * w.x + TINT[1][0] * w.y + TINT[2][0] * w.z + TINT[3][0] * w.w;
  const g = TINT[0][1] * w.x + TINT[1][1] * w.y + TINT[2][1] * w.z + TINT[3][1] * w.w;
  const b = TINT[0][2] * w.x + TINT[1][2] * w.y + TINT[2][2] * w.z + TINT[3][2] * w.w;
  out.setRGB(r, g, b, SRGBColorSpace);
}
