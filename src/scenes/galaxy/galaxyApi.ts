/** Small bridge between the galaxy overlay buttons and the 3D scene. */
export const galaxyApi = {
  zoom: (_factor: number) => {},
  reset: () => {},
};

/**
 * Object labels live in the overlay (GalaxyUI) and register their elements here.
 * The 3D scene moves them every frame straight on the DOM, so no React render is involved.
 */
export const galaxyLabels: Record<string, HTMLElement | null> = {};

/** Shared scene time so objects orbit exactly like the star sheet. */
export const galaxyClock = { t: 0 };
