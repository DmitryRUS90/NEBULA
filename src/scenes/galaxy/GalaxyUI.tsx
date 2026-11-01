import { ArrowRight, ArrowsIn, CrosshairSimple, Minus, Plus, Planet, Scan, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button, IconButton, Meter, Panel, SceneTitle } from '../../components/ui';
import { audio } from '../../core/audio';
import { goTo } from '../../core/navigation';
import { useStore } from '../../core/store';
import { GALAXY_OBJECTS } from '../../data/galaxy';
import { galaxyApi } from './galaxyApi';

export function GalaxyUI() {
  const selectedId = useStore((s) => s.galaxySelected);
  const scanned = useStore((s) => s.scanned);
  const select = useStore((s) => s.galaxySelect);
  const scanObject = useStore((s) => s.scanObject);
  const setWorld = useStore((s) => s.setWorld);
  const busy = useStore((s) => s.transitioning);
  const selected = GALAXY_OBJECTS.find((o) => o.id === selectedId) ?? null;
  const [scanning, setScanning] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => setScanning(false), [selectedId]);

  const doScan = () => {
    if (!selected || scanning || scanned.includes(selected.id)) return;
    setScanning(true);
    audio.play('scan');
    window.setTimeout(() => {
      scanObject(selected.id);
      audio.play('confirm');
      setScanning(false);
    }, 1300);
  };

  const isScanned = !!selected && scanned.includes(selected.id);

  return (
    <section className="scene-ui galaxy-ui" aria-label="Galaxy map">
      <div className="galaxy-top">
        <SceneTitle n="02" name="Galaxy map" sub="Exploration" />
        <p className="galaxy-hint body-6">
          <span className="hint-desktop">Drag to rotate. Scroll to zoom. Select an object to read its signal.</span>
          <span className="hint-touch">Drag to rotate. Pinch to zoom. Tap an object to read its signal.</span>
        </p>
      </div>

      <div className="galaxy-tools" role="group" aria-label="Map controls">
        <IconButton label="Zoom in" onClick={() => galaxyApi.zoom(0.72)}>
          <Plus size={18} weight="bold" />
        </IconButton>
        <IconButton label="Zoom out" onClick={() => galaxyApi.zoom(1.38)}>
          <Minus size={18} weight="bold" />
        </IconButton>
        <IconButton label="Reset the view" onClick={() => galaxyApi.reset()}>
          <ArrowsIn size={18} weight="bold" />
        </IconButton>
        <IconButton label="Show the object list" className="galaxy-list-toggle" onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen}>
          <Planet size={18} weight="bold" />
        </IconButton>
      </div>

      <Panel className={`galaxy-list ${listOpen ? 'is-open' : ''}`} eyebrow="Detected" title={`${scanned.length} of ${GALAXY_OBJECTS.length} scanned`} index={1}>
        <Meter value={scanned.length / GALAXY_OBJECTS.length} label="Objects scanned" className="galaxy-progress" />
        <ul className="galaxy-items">
          {GALAXY_OBJECTS.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className={`galaxy-item ${selectedId === o.id ? 'is-active' : ''}`}
                onClick={() => {
                  audio.play('select');
                  select(o.id);
                  setListOpen(false);
                }}
                onPointerEnter={() => audio.play('hover')}
              >
                <span className="galaxy-swatch" style={{ background: o.color, boxShadow: `0 0 12px ${o.color}` }} />
                <span className="galaxy-item-text">
                  <span className="body-6 galaxy-item-name">{o.name}</span>
                  <span className="caption-4 galaxy-item-kind">{o.kind}</span>
                </span>
                {scanned.includes(o.id) && <span className="galaxy-item-done mono caption-4">Scanned</span>}
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.aside
            key={selected.id}
            className="panel galaxy-card"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            aria-label={`${selected.name} details`}
          >
            <header className="galaxy-card-head">
              <div>
                <p className="eyebrow" style={{ color: selected.color }}>
                  {selected.kind}
                </p>
                <h3 className="heading-5 galaxy-card-name">{selected.name}</h3>
                <p className="mono caption-4 galaxy-card-sector">{selected.sector}</p>
              </div>
              <IconButton label="Close" onClick={() => select(null)}>
                <X size={16} weight="bold" />
              </IconButton>
            </header>
            <p className="body-6 galaxy-card-desc">{selected.desc}</p>
            <dl className="readouts">
              <div>
                <dt className="caption-4">Distance</dt>
                <dd className="mono body-6">{selected.distance}</dd>
              </div>
              {selected.readouts.map(([k, v]) => (
                <div key={k}>
                  <dt className="caption-4">{k}</dt>
                  <dd className="mono body-6">{v}</dd>
                </div>
              ))}
            </dl>

            <AnimatePresence initial={false}>
              {isScanned && (
                <motion.p
                  className="galaxy-scan-result body-6"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <CrosshairSimple size={16} weight="bold" /> {selected.scan}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="galaxy-card-actions">
              {!isScanned && (
                <Button variant="primary" onClick={doScan} disabled={scanning} sound={null} icon={<Scan size={18} weight="bold" />}>
                  {scanning ? 'Scanning' : 'Scan object'}
                </Button>
              )}
              {selected.world && (
                <Button
                  variant={isScanned ? 'primary' : 'ghost'}
                  disabled={busy}
                  icon={<Planet size={18} weight="bold" />}
                  onClick={() => {
                    setWorld(selected.world!);
                    goTo('worlds');
                  }}
                >
                  Visit this world
                </Button>
              )}
            </div>
            {scanning && <div className="scan-bar" aria-hidden />}
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <div className="scene-next">
        <Button variant="primary" size="lg" disabled={busy} iconAfter={<ArrowRight size={20} weight="bold" />} onClick={() => goTo('worlds')}>
          Discover worlds
        </Button>
      </div>
    </section>
  );
}
