import { ArrowRight, Broadcast } from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Button, Meter, Panel, SceneTitle } from '../../components/ui';
import { audio } from '../../core/audio';
import { goTo } from '../../core/navigation';
import { useStore } from '../../core/store';
import { WORLDS, WORLD_ORDER, type WorldDef, type WorldId } from '../../data/worlds';
import './worlds.css';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/** A bar that grows from empty after it mounts, so a world change reads as a measurement. */
function MetricBar({ fill }: { fill: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(fill));
    return () => cancelAnimationFrame(id);
  }, [fill]);
  return <Meter value={v} tone={fill >= 0.7 ? 'warn' : 'cyan'} />;
}

function WorldInfo({ w }: { w: WorldDef }) {
  return (
    <>
      <header className="worlds-info-head">
        <p className="eyebrow" style={{ color: w.accent }}>
          {w.klass}
        </p>
        <h3 className="heading-5 worlds-name">{w.name}</h3>
      </header>
      <p className="body-6 worlds-desc">{w.desc}</p>
      <ul className="worlds-metrics" aria-label={`${w.name} readings`}>
        {w.metrics.map((m) => (
          <li key={m.label}>
            <span className="worlds-metric-row">
              <span className="caption-4 worlds-metric-label">{m.label}</span>
              <span className="mono caption-4">{m.value}</span>
            </span>
            <MetricBar fill={m.fill} />
          </li>
        ))}
      </ul>
      <p className="worlds-log body-6">
        <Broadcast size={16} weight="bold" aria-hidden />
        <span>{w.log}</span>
      </p>
    </>
  );
}

export function WorldsUI() {
  const world = useStore((s) => s.world);
  const visited = useStore((s) => s.worldsVisited);
  const setWorld = useStore((s) => s.setWorld);
  const busy = useStore((s) => s.transitioning);
  const calm = useReducedMotion();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const w = WORLDS[world];

  // the world chosen in the galaxy counts as visited the moment this scene opens
  useEffect(() => {
    setWorld(useStore.getState().world);
  }, [setWorld]);

  const choose = (id: WorldId, focus = false) => {
    if (id !== world) audio.play('select');
    setWorld(id);
    if (focus) refs.current[id]?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const i = WORLD_ORDER.indexOf(world);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % WORLD_ORDER.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + WORLD_ORDER.length) % WORLD_ORDER.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = WORLD_ORDER.length - 1;
    if (next < 0) return;
    e.preventDefault();
    choose(WORLD_ORDER[next], true);
  };

  return (
    <section className="scene-ui worlds-ui" aria-label="Worlds">
      <div className="worlds-top">
        <SceneTitle n="03" name="Worlds" sub="Unknown planets" />
        <p className="body-6 worlds-hint">Drag the planet to turn it. Pick a world to change its sky.</p>
      </div>

      <Panel className="worlds-panel" label="World details" index={1}>
        <div className="worlds-panel-head">
          <p className="eyebrow">Choose a world</p>
          <p className="worlds-progress mono caption-4" aria-live="polite">
            <span className="worlds-dots" aria-hidden>
              {WORLD_ORDER.map((id) => (
                <i key={id} className={visited.includes(id) ? 'is-on' : ''} />
              ))}
            </span>
            {visited.length} of 3 visited
          </p>
        </div>

        <div className="worlds-choices" role="radiogroup" aria-label="Worlds" onKeyDown={onKey}>
          {WORLD_ORDER.map((id) => {
            const d = WORLDS[id];
            const active = id === world;
            return (
              <button
                key={id}
                ref={(el) => void (refs.current[id] = el)}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                className={`worlds-choice ${active ? 'is-active' : ''}`}
                style={{ ['--accent' as string]: d.accent }}
                onClick={() => choose(id)}
                onPointerEnter={() => audio.play('hover')}
              >
                <span className="worlds-choice-dot" aria-hidden />
                <span className="title-4 worlds-choice-name">{d.designation}</span>
                <span className="caption-5 worlds-choice-class">{d.klass}</span>
                {visited.includes(id) && !active && <span className="visually-hidden">Visited</span>}
              </button>
            );
          })}
        </div>

        <div className="worlds-info" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={world}
              initial={{ opacity: 0, y: calm ? 0 : 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: calm ? 0 : -8 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <WorldInfo w={w} />
            </motion.div>
          </AnimatePresence>
        </div>
      </Panel>

      <div className="scene-next">
        <Button variant="primary" size="lg" disabled={busy} iconAfter={<ArrowRight size={20} weight="bold" />} onClick={() => goTo('laboratory')}>
          Enter laboratory
        </Button>
      </div>
    </section>
  );
}
