import type { ComponentType } from 'react';
import type { SceneId } from '../core/scenes';
import { PortalScene } from '../scenes/portal/PortalScene';
import { PortalUI } from '../scenes/portal/PortalUI';
import { GalaxyScene } from '../scenes/galaxy/GalaxyScene';
import { GalaxyUI } from '../scenes/galaxy/GalaxyUI';
import { WorldsScene } from '../scenes/worlds/WorldsScene';
import { WorldsUI } from '../scenes/worlds/WorldsUI';
import { LaboratoryScene } from '../scenes/laboratory/LaboratoryScene';
import { LaboratoryUI } from '../scenes/laboratory/LaboratoryUI';
import { ControlScene } from '../scenes/control/ControlScene';
import { ControlUI } from '../scenes/control/ControlUI';
import { CoreScene } from '../scenes/core/CoreScene';
import { CoreUI } from '../scenes/core/CoreUI';
import { BeyondScene } from '../scenes/beyond/BeyondScene';
import { BeyondUI } from '../scenes/beyond/BeyondUI';

/**
 * The two registries that make a scene. A scene is a 3D group that lives inside the shared canvas
 * and a DOM overlay that sits above it. To add a scene, add a row to core/scenes.ts and one here.
 */
export const SCENE_3D: Record<SceneId, ComponentType> = {
  portal: PortalScene,
  galaxy: GalaxyScene,
  worlds: WorldsScene,
  laboratory: LaboratoryScene,
  control: ControlScene,
  core: CoreScene,
  beyond: BeyondScene,
};

export const SCENE_UI: Record<SceneId, ComponentType> = {
  portal: PortalUI,
  galaxy: GalaxyUI,
  worlds: WorldsUI,
  laboratory: LaboratoryUI,
  control: ControlUI,
  core: CoreUI,
  beyond: BeyondUI,
};
