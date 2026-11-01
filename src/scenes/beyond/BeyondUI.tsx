import { ArrowRight, ArrowsClockwise, CheckCircle, Lock, Planet, Sparkle } from '@phosphor-icons/react';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { Button, Meter, Panel, SceneTitle, WordReveal } from '../../components/ui';
import { audio } from '../../core/audio';
import { useMedia } from '../../core/hooks';
import { goTo, startNewExploration } from '../../core/navigation';
import { useStore } from '../../core/store';
import { prefersReducedMotion } from '../../core/util';
import { beyondApi } from './beyondApi';
import { TOTALS, useResults } from './results';
import './beyond.css';

const TAGLINE = 'You crossed the unknown and it answered. Everything you found is still out there, waiting for the next jump.';

function CountUp({ value }: { value: number }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (prefersReducedMotion()) {
      node.textContent = String(value);
      return;
    }
    const proxy = { v: Number(node.textContent) || 0 };
    const tw = gsap.to(proxy, { v: value, duration: 1.6, ease: 'nebula', delay: 0.5, onUpdate: () => (node.textContent = String(Math.round(proxy.v))) });
    return () => {
      tw.kill();
    };
  }, [value]);
  return (
    <span ref={el} className="mono">
      0
    </span>
  );
}

export function BeyondUI() {
  const r = useResults();
  const busy = useStore((s) => s.transitioning);
  const wide = useMedia('(min-width: 1100px)');
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReveal(true), prefersReducedMotion() ? 0 : 900);
    return () => window.clearTimeout(id);
  }, []);

  const tagline = (
    <h2 className="beyond-tagline heading-3 grad-text">
      <WordReveal text={TAGLINE} active={reveal} step={0.16} />
    </h2>
  );

  const stats: { label: string; value: string; tone?: string; sub?: string }[] = [
    { label: 'Objects scanned', value: `${r.scanned} of ${TOTALS.objects}` },
    { label: 'Worlds visited', value: `${r.worlds} of ${TOTALS.worlds}` },
    { label: 'Lab modes', value: `${r.labModes} of ${TOTALS.modes}` },
    { label: 'Lab nodes', value: `${r.labNodes} of ${TOTALS.nodes}` },
    { label: 'Ship controls', value: `${r.controls} of ${TOTALS.controls}` },
    { label: 'Contacts identified', value: String(r.identified) },
  ];

  return (
    <section className="scene-ui beyond-ui" aria-label="Beyond">
      <div className="beyond-left">
        <SceneTitle n="07" name="Beyond" sub="Final scene" />
        {wide && tagline}
      </div>

      <div className="beyond-col" tabIndex={-1}>
        {!wide && tagline}

        <Panel className="beyond-index" eyebrow="Exploration index" index={0}>
          <p className="beyond-index-row">
            <span className="heading-2 beyond-index-num">
              <CountUp value={r.index} />
            </span>
            <span className="body-6 beyond-index-unit">percent explored</span>
          </p>
          <Meter value={r.index / 100} label="Exploration index" tone="ok" />
          <div className="beyond-actions">
            <Button variant="primary" icon={<ArrowsClockwise size={18} weight="bold" />} disabled={busy} onClick={startNewExploration}>
              Start new exploration
            </Button>
            {r.next && (
              <Button iconAfter={<ArrowRight size={18} weight="bold" />} disabled={busy} onClick={() => goTo(r.next!.scene)}>
                Continue exploring
              </Button>
            )}
            <Button icon={<Sparkle size={18} weight="bold" />} sound={null} onClick={() => beyondApi.surge()}>
              Pulse the gateway
            </Button>
          </div>
        </Panel>

        <Panel eyebrow="Journey log" index={1}>
          <dl className="beyond-stats">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="caption-4">{s.label}</dt>
                <dd className="mono body-5">{s.value}</dd>
              </div>
            ))}
            <div className={`beyond-core is-${r.core.state}`}>
              <dt className="caption-4">Energy core</dt>
              <dd className="mono body-5">{r.core.value}</dd>
              <dd className="caption-5 beyond-core-sub">{r.core.sub}</dd>
            </div>
          </dl>
        </Panel>

        <Panel eyebrow="Achievements" title={`${r.achievements.filter((a) => a.earned).length} of ${r.achievements.length} earned`} index={2}>
          <ul className="beyond-ach">
            {r.achievements.map((a) => {
              const Icon = a.icon;
              return (
                <li key={a.id} className={`beyond-ach-item ${a.earned ? 'is-earned' : ''}`} title={a.earned ? a.desc : a.missing} tabIndex={0}>
                  <span className="beyond-ach-icon" aria-hidden>
                    {a.earned ? <Icon size={20} weight="bold" /> : <Lock size={20} weight="bold" />}
                  </span>
                  <span className="beyond-ach-text">
                    <span className="title-4">{a.title}</span>
                    <span className="caption-5 beyond-ach-desc">{a.earned ? a.desc : a.missing}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel eyebrow="Still open" title={r.remaining.length ? `${r.remaining.length} places to return to` : 'Nothing left open'} index={3}>
          {r.nothing && (
            <p className="beyond-empty body-6">
              <Planet size={18} weight="bold" /> You have not explored anything yet. The galaxy map is the best place to begin.
            </p>
          )}
          {r.remaining.length === 0 ? (
            <p className="beyond-empty body-6 is-done">
              <CheckCircle size={18} weight="bold" /> Every scene is complete. The gateway is yours to pulse, or you can start again.
            </p>
          ) : (
            <ul className="beyond-rem">
              {r.remaining.map((row) => (
                <li key={row.scene}>
                  <button
                    type="button"
                    className={`beyond-rem-row ${r.next?.scene === row.scene ? 'is-next' : ''}`}
                    disabled={busy}
                    onClick={() => {
                      audio.play('select');
                      goTo(row.scene);
                    }}
                    onPointerEnter={() => audio.play('hover')}
                  >
                    <span className="beyond-rem-text">
                      <span className="title-4">
                        {row.name}
                        {r.next?.scene === row.scene && <span className="beyond-next-tag caption-3">Next</span>}
                      </span>
                      <span className="caption-5 beyond-rem-detail">{row.detail}</span>
                    </span>
                    <ArrowRight size={16} weight="bold" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}
