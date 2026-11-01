import { ArrowRight, ArrowsIn, CaretUp, CheckCircle, Lightning, Sliders } from '@phosphor-icons/react';
import { Button, IconButton, Meter, Panel, Range, SceneTitle, Switch } from '../../components/ui';
import { audio } from '../../core/audio';
import { useMedia } from '../../core/hooks';
import { goTo } from '../../core/navigation';
import { useStore } from '../../core/store';
import { useEffect, useState } from 'react';
import { labApi } from './labApi';
import { toggleNode } from './labActions';
import { computeReadouts, FREQ_MAX, MODES, NODES, OUTPUT_MAX } from './labData';
import './laboratory.css';

function useReadouts() {
  const mode = useStore((s) => s.labMode);
  const count = useStore((s) => s.labNodes.length);
  const scale = useStore((s) => s.labScale);
  return computeReadouts(mode, count, scale);
}

function Readouts({ compact = false }: { compact?: boolean }) {
  const r = useReadouts();
  const items = [
    { k: 'Output', v: `${r.output.toFixed(1)} TW`, m: r.output / OUTPUT_MAX, tone: 'cyan' as const },
    { k: 'Stability', v: `${r.stability.toFixed(1)}%`, m: r.stability / 100, tone: r.locked ? ('ok' as const) : ('violet' as const) },
    { k: 'Frequency', v: `${r.frequency.toFixed(2)} Hz`, m: r.frequency / FREQ_MAX, tone: 'cyan' as const },
    { k: 'Phase', v: r.locked ? 'Locked' : `${Math.round(r.phase)}°`, m: r.locked ? 1 : r.phase / 360, tone: r.locked ? ('ok' as const) : ('violet' as const) },
  ];
  if (compact) {
    return (
      <dl className="lab-strip" aria-label="Live readouts">
        {items.map((i) => (
          <div key={i.k}>
            <dt className="caption-4">{i.k}</dt>
            <dd className="mono caption-3">{i.v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <>
      <dl className="lab-readouts-list">
        {items.map((i) => (
          <div key={i.k} className="lab-readout">
            <div className="lab-readout-row">
              <dt className="caption-4">{i.k}</dt>
              <dd className="mono body-5">{i.v}</dd>
            </div>
            <Meter value={i.m} tone={i.tone} label={i.k} />
          </div>
        ))}
      </dl>
      {r.locked && (
        <p className="lab-locked body-5">
          <CheckCircle size={18} weight="bold" /> Resonance reached. The lattice is locked.
        </p>
      )}
    </>
  );
}

function Controls() {
  const mode = useStore((s) => s.labMode);
  const setMode = useStore((s) => s.setLabMode);
  const nodes = useStore((s) => s.labNodes);
  const scale = useStore((s) => s.labScale);
  const setScale = useStore((s) => s.setLabScale);
  const spin = useStore((s) => s.labSpin);
  const setSpin = useStore((s) => s.setLabSpin);
  const note = MODES.find((m) => m.id === mode)?.note;

  return (
    <div className="lab-controls-body">
      <div className="lab-group">
        <p className="eyebrow">Visualization</p>
        <div className="segmented" role="radiogroup" aria-label="Visualization mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              className={`segment ${mode === m.id ? 'is-active' : ''} button-sm`}
              onClick={() => {
                audio.play('select');
                setMode(m.id);
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="lab-note body-6" aria-live="polite">
          {note}
        </p>
      </div>

      <div className="lab-group">
        <Range label="Scale" value={scale} min={0.6} max={1.6} step={0.05} onChange={setScale} format={(v) => `${v.toFixed(2)}x`} onTick={() => audio.play('tick')} />
        <Switch checked={spin} onChange={setSpin} label="Auto rotate" hint="Turns the view slowly when idle" />
      </div>

      <div className="lab-group">
        <p className="lab-nodes-head">
          <span className="eyebrow">Nodes</span>
          <span className="mono caption-4 lab-count">{nodes.length} of 4 active</span>
        </p>
        <ul className="lab-nodes">
          {NODES.map((n, i) => {
            const on = nodes.includes(i);
            return (
              <li key={n.name}>
                <button type="button" className={`lab-node ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggleNode(i)} onPointerEnter={() => audio.play('hover')}>
                  <span className="lab-swatch" style={{ background: n.color, boxShadow: on ? `0 0 12px ${n.color}` : 'none' }} />
                  <span className="lab-node-text">
                    <span className="body-5">{n.name}</span>
                    <span className="caption-4 lab-node-hint">{n.hint}</span>
                  </span>
                  <span className="mono caption-4 lab-node-state">{on ? 'Active' : 'Idle'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function LaboratoryUI() {
  const busy = useStore((s) => s.transitioning);
  const mobile = useMedia('(max-width: 899px)');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    labApi.sheetOpen = mobile && open;
    return () => {
      labApi.sheetOpen = false;
    };
  }, [mobile, open]);

  return (
    <section className="scene-ui lab-ui" aria-label="Laboratory">
      <div className="lab-top">
        <SceneTitle n="04" name="Laboratory" sub="Research" />
        <p className="lab-hint body-6">
          <span className="lab-hint-desktop">Drag to rotate. Scroll to zoom. Select a node to wake it.</span>
          <span className="lab-hint-touch">Drag to rotate. Pinch to zoom. Tap a node to wake it.</span>
        </p>
      </div>

      {!mobile && (
        <>
          <Panel className="lab-panel" eyebrow="Chamber" title="Controls" index={1}>
            <Controls />
          </Panel>
          <Panel className="lab-readouts" eyebrow="Readouts" title="Artifact" index={2}>
            <Readouts />
          </Panel>
        </>
      )}

      <div className="lab-dock">
        {mobile && (
          <>
            {open && (
              <div className="panel lab-sheet" id="lab-sheet" role="region" aria-label="Chamber controls">
                <Controls />
              </div>
            )}
            <Readouts compact />
          </>
        )}
        <div className="lab-actions">
          {mobile && (
            <Button icon={<Sliders size={18} weight="bold" />} iconAfter={<CaretUp size={14} weight="bold" className={`lab-caret ${open ? 'is-open' : ''}`} />} aria-expanded={open} aria-controls="lab-sheet" onClick={() => setOpen((v) => !v)}>
              Controls
            </Button>
          )}
          <IconButton label="Reset the view" onClick={() => labApi.resetView()}>
            <ArrowsIn size={18} weight="bold" />
          </IconButton>
          <Button
            icon={<Lightning size={18} weight="bold" />}
            sound="ping"
            onClick={() => labApi.pulse()}
          >
            Send a pulse
          </Button>
        </div>
        <Button variant="primary" size="lg" disabled={busy} iconAfter={<ArrowRight size={20} weight="bold" />} onClick={() => goTo('control')}>
          Enter control center
        </Button>
      </div>
    </section>
  );
}
