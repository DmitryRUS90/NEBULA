import { SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { audio } from '../core/audio';
import { goTo } from '../core/navigation';
import { TIER_LABEL, type Tier } from '../core/perf';
import { sceneDef, SCENES } from '../core/scenes';
import { useStore, type QualityPref } from '../core/store';
import { IconButton } from './ui';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];
const QUALITY: { id: QualityPref; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'high', label: 'High' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'lite', label: 'Lite' },
];

/** The menu toggle: two lines that turn into a cross instead of swapping instantly. */
function Burger({ open }: { open: boolean }) {
  return (
    <span className={`burger ${open ? 'is-open' : ''}`} aria-hidden>
      <span />
      <span />
    </span>
  );
}

function Settings({ mobile }: { mobile: boolean }) {
  const sound = useStore((s) => s.sound);
  const setSound = useStore((s) => s.setSound);
  const pref = useStore((s) => s.qualityPref);
  const setPref = useStore((s) => s.setQualityPref);
  const tier = useStore((s) => s.tier);
  const reason = useStore((s) => s.tierReason);

  return (
    <div className="menu-settings">
      <p className="eyebrow">Sound</p>
      <button
        type="button"
        role="switch"
        aria-checked={sound}
        className={`menu-switch ${sound ? 'is-on' : ''} body-5`}
        onClick={() => {
          const on = !sound;
          if (on) audio.start();
          audio.setEnabled(on);
          setSound(on);
          if (on) window.setTimeout(() => audio.play('on'), 60);
        }}
      >
        {sound ? <SpeakerHigh size={18} weight="bold" /> : <SpeakerSlash size={18} weight="bold" />}
        <span>{sound ? 'Sound is on' : 'Sound is off'}</span>
      </button>

      <p className="eyebrow">Quality</p>
      <div className="segmented" role="radiogroup" aria-label="Graphics quality">
        {QUALITY.map((q) => (
          <button
            key={q.id}
            type="button"
            role="radio"
            aria-checked={pref === q.id}
            className={`segment ${pref === q.id ? 'is-active' : ''} button-sm`}
            onClick={() => {
              audio.play('select');
              setPref(q.id);
            }}
          >
            {q.label}
          </button>
        ))}
      </div>
      <p className="caption-5 menu-note">
        Now running {TIER_LABEL[tier as Tier]}. {pref === 'auto' ? `Chosen for this device: ${reason}.` : 'Set by you.'} Lite uses fewer particles and a lower resolution for slower devices.
      </p>
      {mobile && <span className="visually-hidden">Settings</span>}
    </div>
  );
}

export function HUD() {
  const scene = useStore((s) => s.scene);
  const pending = useStore((s) => s.pending);
  const entered = useStore((s) => s.entered);
  const busy = useStore((s) => s.transitioning);
  const sound = useStore((s) => s.sound);
  const setSound = useStore((s) => s.setSound);
  const [open, setOpen] = useState(false);
  const def = sceneDef(scene);
  const shown = pending ?? scene;

  useEffect(() => {
    audio.setEnabled(sound);
  }, [sound]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const go = (id: (typeof SCENES)[number]['id']) => {
    setOpen(false);
    if (id === scene || busy) return;
    goTo(id);
  };

  return (
    <header className="hud">
      <nav className="hud-bar" aria-label="Scenes and settings">
        <button
          type="button"
          className="hud-brand heading-6"
          onClick={() => (entered ? go('portal') : undefined)}
          aria-label={entered ? 'NEBULA, back to the portal' : 'NEBULA'}
          aria-current={scene === 'portal' ? 'page' : undefined}
          disabled={!entered}
        >
          <span className="hud-brand-dot" aria-hidden />
          NEBULA
        </button>

        {entered && (
          <ol className="rail" aria-label="Scenes">
            {SCENES.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`rail-item ${shown === s.id ? 'is-active' : ''} caption-3`}
                  aria-current={scene === s.id ? 'page' : undefined}
                  aria-label={`${s.n} ${s.name}`}
                  title={`${s.n} ${s.name}`}
                  disabled={busy && shown !== s.id}
                  onClick={() => {
                    audio.play('click');
                    go(s.id);
                  }}
                  onPointerEnter={() => audio.play('hover')}
                >
                  <span className="mono">{s.n}</span>
                  <span className="rail-name">{s.name}</span>
                </button>
              </li>
            ))}
          </ol>
        )}

        {entered && (
          <p className="hud-now mono caption-3" aria-hidden>
            {def.n} {def.name}
          </p>
        )}

        <div className="hud-tools">
          <IconButton
            label={sound ? 'Turn sound off' : 'Turn sound on'}
            className="hud-icon"
            sound={null}
            onClick={() => {
              const on = !sound;
              if (on) audio.start();
              audio.setEnabled(on);
              setSound(on);
              if (on) window.setTimeout(() => audio.play('on'), 60);
            }}
          >
            {sound ? <SpeakerHigh size={18} weight="bold" /> : <SpeakerSlash size={18} weight="bold" />}
          </IconButton>
          <IconButton
            label={open ? 'Close the menu' : 'Open the menu'}
            className="hud-icon hud-menu"
            aria-expanded={open}
            aria-controls="hud-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <Burger open={open} />
          </IconButton>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            key="menu"
            id="hud-menu"
            className="menu"
            role="dialog"
            aria-label="Menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <button type="button" className="menu-scrim" aria-label="Close the menu" onClick={() => setOpen(false)} tabIndex={-1} />
            <div className="menu-panel">
              {entered && (
                <ul className="menu-scenes" aria-label="Scenes">
                  {SCENES.map((s, i) => (
                    <motion.li
                      key={s.id}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: EASE, delay: Math.min(0.06 * i, 0.4) }}
                    >
                      <button
                        type="button"
                        className={`menu-link ${scene === s.id ? 'is-active' : ''}`}
                        aria-current={scene === s.id ? 'page' : undefined}
                        disabled={busy}
                        onClick={() => {
                          audio.play('click');
                          go(s.id);
                        }}
                      >
                        <span className="mono caption-3">{s.n}</span>
                        <span className="heading-5">{s.name}</span>
                        <span className="caption-5 menu-link-sub">{s.sub}</span>
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}
              <Settings mobile />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
