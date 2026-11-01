import { ArrowRight } from '@phosphor-icons/react';
import { Button, WordReveal } from '../../components/ui';
import { enterPortal } from '../../core/navigation';
import { useStore } from '../../core/store';

export function PortalUI() {
  const opening = useStore((s) => s.portalOpening);
  const busy = useStore((s) => s.transitioning);

  return (
    <section className={`scene-ui portal-ui ${opening ? 'is-opening' : ''}`} aria-labelledby="portal-title">
      <div className="portal-copy">
        <p className="eyebrow reveal" style={{ ['--d' as string]: '0.1s' }}>
          Signal 0427 · Origin unknown
        </p>
        <h1 id="portal-title" className="portal-title heading-1 grad-text reveal" style={{ ['--d' as string]: '0.2s' }}>
          NEBULA
        </h1>
        <p className="portal-lede title-2 reveal" style={{ ['--d' as string]: '0.35s' }}>
          An interactive journey through a universe that does not exist yet. Open the portal and look around.
        </p>
        <div className="reveal" style={{ ['--d' as string]: '0.5s' }}>
          <Button variant="primary" size="lg" disabled={busy} onClick={enterPortal} iconAfter={<ArrowRight weight="bold" size={20} />} sound={null}>
            Enter the unknown
          </Button>
        </div>
      </div>

      <p className="portal-tagline heading-3 grad-text" aria-live="polite">
        <WordReveal text="Every door you open leads somewhere further than the last." active={opening} step={0.16} />
      </p>

      <ul className="portal-meta mono caption-4 reveal" style={{ ['--d' as string]: '0.8s' }}>
        <li>7 scenes</li>
        <li>Real time 3D</li>
        <li>Sound is optional</li>
      </ul>
    </section>
  );
}
