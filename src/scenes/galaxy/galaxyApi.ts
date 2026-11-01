/** Small bridge between the galaxy overlay buttons and the 3D scene. */
export const galaxyApi = {
  zoom: (_factor: number) => {},
  reset: () => {},
};

/** Shared scene time so objects orbit exactly like the star sheet. */
export const galaxyClock = { t: 0 };
