import { useEffect, useState } from 'react';
import { Boot, NoWebGL } from './components/Boot';
import { HUD } from './components/HUD';
import { SCENE_UI } from './components/registry';
import { Stage } from './components/Stage';
import { Toast } from './components/Toast';
import { TransitionOverlay } from './components/TransitionOverlay';
import { sceneDef } from './core/scenes';
import { hasWebGL } from './core/perf';
import { useStore } from './core/store';

function SceneOverlay() {
  const scene = useStore((s) => s.scene);
  const busy = useStore((s) => s.transitioning);
  const pending = useStore((s) => s.pending);
  const ActiveUI = SCENE_UI[scene];
  // the old overlay fades out when a move starts, the new one mounts when the scene is committed
  const leaving = busy && pending !== null && pending !== scene;
  const def = sceneDef(scene);

  return (
    <main id="main" className={`overlay ${leaving ? 'is-leaving' : ''} ${busy ? 'is-busy' : ''}`} tabIndex={-1}>
      <p className="visually-hidden" aria-live="polite">
        Scene {def.n}, {def.name}
      </p>
      <ActiveUI key={scene} />
    </main>
  );
}

export default function App() {
  const [webgl] = useState(() => hasWebGL());

  useEffect(() => {
    document.documentElement.dataset.ready = 'true';
  }, []);

  if (!webgl) return <NoWebGL />;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Stage />
      <SceneOverlay />
      <HUD />
      <Toast />
      <TransitionOverlay />
      <Boot />
    </>
  );
}
