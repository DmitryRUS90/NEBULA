# NEBULA — architecture and plan

## Stack

Vite + React 19 + TypeScript, Three.js through React Three Fiber, GSAP for transitions and tweens, Framer Motion for interface motion, zustand for state, Phosphor icons, Geist and Geist Mono (variable) as the only typefaces.

Vite replaces Next.js on purpose: the project is a client only experience with no routing, no server rendering and no API, so a plain SPA is lighter and starts faster.

## One space, not seven pages

NEBULA runs inside a single persistent WebGL canvas. The nebula backdrop and the starfield never unmount, so every move between scenes is a flight through the same sky: stars stretch into streaks, the field of view kicks, letterbox bars close and a flash covers the swap. Each scene contributes only its own 3D group and its own DOM overlay.

```
src/
  core/        store, scene registry, navigation (transitions), fx state,
               audio engine, performance tiers and monitor, helpers
  gfx/         shared GPU pieces: nebula bake and backdrop, starfield, glow texture, GLSL noise
  components/  Stage (canvas), HUD, transition overlay, toasts, error boundary, UI kit
  data/        galaxy objects, worlds, copy
  scenes/      one folder per scene: <Scene>.tsx (3D) and <Scene>UI.tsx (overlay)
  styles/      tokens.css (design tokens), global.css, ui.css
```

To change a scene, edit its folder. To add one, add a folder and a row in `core/scenes.ts` and in the two registries in `components/registry.ts`.

## State

`core/store.ts` is the only source of truth for things that cross scenes: current scene, discoveries (scanned objects, visited worlds, lab modes and nodes), ship systems, the result of the core game, sound and quality settings. Per frame data (game physics, shader uniforms, transition values) lives in plain mutable objects (`fx`, `game`) and never goes through React.

## Transitions

`core/navigation.ts → goTo(scene)` runs one GSAP timeline: letterbox in, warp up, flash, commit the scene, flash out, warp down, letterbox out. The portal has an extra opening phase. With reduced motion the timeline collapses to a short crossfade.

## Visual system

Palette from the brief: Space Black #070B18, Deep Blue #182B55, Nebula Violet #7356D9, Energy Cyan #27D8F2. Interface rules come from the installed `landing-page-design` skill, Part B: Tailwind type scale only, the spacing table only, Tailwind radii with the nested radius formula, one cubic bezier curve (0.22, 1, 0.36, 1), transform and opacity only, full state sets, Phosphor icons, no hyphens in copy, no orphaned words.

Where the brief overrides the skill: the dark palette and glow (the skill allows only flat blacks and no gradients), uppercase labels, and the page structure (this is an experience, not a conversion page, so Part A sections such as FAQ and pricing do not apply).

## Performance

Three tiers: high, balanced, lite. Detected at start from cores, memory, pointer type, screen size, reduced motion and software renderers, then lowered automatically if the frame rate stays under 30 for several seconds. The user can also pick a tier by hand. Tiers change pixel ratio, star and particle counts, geometry detail, noise octaves and the size of the baked nebula cube map. The nebula itself is baked once into a cube map, so each frame costs one texture read.

## Reliability

No external models or textures, so there is nothing to fail to download. Shader compilation, context loss and render errors are still handled: an error boundary around the canvas offers a retry and a switch to lite, a lost WebGL context is restored automatically, and a browser without WebGL gets a calm explanation screen.

## Build order

1. Tokens, UI kit, store, navigation, audio, performance
2. Shared GPU pieces: nebula, starfield
3. Scenes 01 to 07 with overlays
4. Verification: type check, production build, browser run, screenshots on desktop, tablet and mobile, interaction pass, low performance pass
