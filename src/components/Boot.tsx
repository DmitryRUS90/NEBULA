import { useStore } from '../core/store';

/** Shown until the first frames are drawn. A bar shaped like the real layout, not a spinner. */
export function Boot() {
  const ready = useStore((s) => s.ready);
  return (
    <div className={`boot ${ready ? 'is-done' : ''}`} aria-hidden={ready} role="status">
      <p className="boot-mark heading-5">NEBULA</p>
      <div className="boot-bar" aria-hidden>
        <span />
      </div>
      <p className="eyebrow">Calibrating the sky</p>
    </div>
  );
}

/** Shown instead of the experience when the browser cannot create a WebGL context. */
export function NoWebGL() {
  return (
    <main id="main" className="nowebgl">
      <div className="panel nowebgl-card">
        <p className="eyebrow">Signal blocked</p>
        <h1 className="heading-4 grad-text">NEBULA needs WebGL.</h1>
        <p className="body-3 nowebgl-text">
          This browser cannot start real time 3D, so the universe has nowhere to draw. Turn on hardware acceleration in the browser settings, update the browser, or open NEBULA in a current version of Chrome, Edge, Firefox or Safari.
        </p>
      </div>
    </main>
  );
}
