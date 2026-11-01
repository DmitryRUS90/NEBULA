import { Canvas, useFrame } from '@react-three/fiber';
import { Component, Suspense, useCallback, useRef, useState, type ReactNode } from 'react';
import type { PerspectiveCamera } from 'three';
import { fx } from '../core/fx';
import { nextLowerTier, TIERS, TIER_LABEL } from '../core/perf';
import { useStore } from '../core/store';
import { Backdrop } from '../gfx/Backdrop';
import { Starfield } from '../gfx/Starfield';
import { Button } from './ui';
import { SCENE_3D } from './registry';

/** Keeps the field of view in step with the transition timeline. */
function Rig() {
  useFrame((state) => {
    const cam = state.camera as PerspectiveCamera;
    const target = fx.baseFov + fx.fovKick;
    if (Math.abs(cam.fov - target) > 0.01) {
      cam.fov = target;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/** Tells the boot screen the first frames are on screen. */
function ReadySignal() {
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current < 4 && ++frames.current === 4) useStore.getState().setReady();
  });
  return null;
}

/** Drops one quality tier when the frame rate stays low. Manual choices are never overridden. */
function PerfMonitor() {
  const acc = useRef({ time: 0, frames: 0, slow: 0, warm: 0 });
  useFrame((_, dt) => {
    const s = useStore.getState();
    if (document.hidden || s.transitioning || s.qualityPref !== 'auto') return;
    const a = acc.current;
    a.warm += dt;
    if (a.warm < 3) return;
    a.time += dt;
    a.frames++;
    if (a.time < 1) return;
    const fps = a.frames / a.time;
    a.time = 0;
    a.frames = 0;
    a.slow = fps < 30 ? a.slow + 1 : Math.max(0, a.slow - 1);
    if (a.slow >= 4) {
      const lower = nextLowerTier(s.tier);
      a.slow = 0;
      a.warm = 0;
      if (lower) {
        s.setTier(lower, 'frame rate');
        s.showToast(`Quality lowered to ${TIER_LABEL[lower]} to keep motion smooth.`, 'warn');
      }
    }
  });
  return null;
}

function SceneHost() {
  const scene = useStore((s) => s.scene);
  const Active = SCENE_3D[scene];
  return (
    <Suspense fallback={null}>
      <Active key={scene} />
    </Suspense>
  );
}

interface BoundaryProps {
  children: ReactNode;
  onRetry: () => void;
}

/** Catches render and shader errors so a broken scene never leaves a blank page. */
class StageBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('NEBULA stage error:', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const tier = useStore.getState().tier;
    return (
      <div className="fallback" role="alert">
        <div className="panel fallback-card">
          <p className="eyebrow">Signal lost</p>
          <h2 className="heading-5">The 3D view stopped.</h2>
          <p className="body-6 fallback-text">
            A scene failed to draw. Try again, or switch to Lite mode, which uses far fewer particles and a lower resolution.
          </p>
          <div className="fallback-actions">
            <Button
              variant="primary"
              onClick={() => {
                this.setState({ error: null });
                this.props.onRetry();
              }}
            >
              Try again
            </Button>
            {tier !== 'lite' && (
              <Button
                onClick={() => {
                  useStore.getState().setQualityPref('lite');
                  this.setState({ error: null });
                  this.props.onRetry();
                }}
              >
                Switch to Lite
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export function Stage() {
  const tier = useStore((s) => s.tier);
  const cfg = TIERS[tier];
  const [epoch, setEpoch] = useState(0);
  const retry = useCallback(() => setEpoch((e) => e + 1), []);

  return (
    <div className="stage" aria-hidden>
      <StageBoundary onRetry={retry}>
        <Canvas
          key={`${epoch}-${cfg.aa ? 'aa' : 'noaa'}`}
          dpr={cfg.dpr}
          flat
          gl={{ antialias: cfg.aa, alpha: false, powerPreference: 'high-performance' }}
          camera={{ fov: 50, near: 0.1, far: 500, position: [0, 0, 10] }}
          onCreated={({ gl }) => {
            const el = gl.domElement;
            el.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              useStore.getState().showToast('Graphics context lost. Restoring the view.', 'warn');
            });
            // render targets are emptied by a lost context, so the nebula is baked again
            el.addEventListener('webglcontextrestored', () => {
              useStore.getState().showToast('Graphics restored.');
              setEpoch((n) => n + 1);
            });
          }}
        >
          <color attach="background" args={['#070B18']} />
          <Rig />
          <Backdrop />
          <Starfield />
          <SceneHost />
          <PerfMonitor />
          <ReadySignal />
        </Canvas>
      </StageBoundary>
    </div>
  );
}
