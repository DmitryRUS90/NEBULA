import { audio } from '../../core/audio';
import { useStore } from '../../core/store';
import { labApi } from './labApi';
import { NODES } from './labData';

/** Shared by the 3D nodes and the overlay list so both do exactly the same thing. */
export function toggleNode(i: number) {
  const s = useStore.getState();
  const wasOn = s.labNodes.includes(i);
  s.toggleLabNode(i);
  audio.play(wasOn ? 'off' : 'on');
  labApi.pulse(NODES[i].dir, NODES[i].color);
}
