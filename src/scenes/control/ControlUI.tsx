import { ArrowRight, Broadcast, CheckCircle, Crosshair, Power, Thermometer } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { Button, Meter, Panel, Range, SceneTitle, Switch } from '../../components/ui';
import { audio } from '../../core/audio';
import { useRaf } from '../../core/hooks';
import { goTo } from '../../core/navigation';
import { useStore, type SwitchKey } from '../../core/store';
import { clamp, fmtTime } from '../../core/util';
import { Radar } from './Radar';
import {
  BUDGET,
  CONTACTS,
  CUTOFF_TEMP,
  SWITCHES,
  SYSTEMS,
  WARN_TEMP,
  applyPower,
  contactDistance,
  diagnostics,
  isDetected,
  lifeStatus,
  rangeOf,
  reactorTarget,
  signalStatus,
  tempStatus,
  totalPower,
} from './sim';
import './control.css';

const GAUGE_MAX = 110;
const HEAT_SWITCHES: SwitchKey[] = ['stealth', 'deepScan', 'beacon'];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const hullStatus = (v: number) => (v >= 80 ? 'Intact' : v >= 50 ? 'Strained' : 'Failing');
const shieldStatus = (v: number) => (v >= 70 ? 'Strong' : v >= 40 ? 'Reduced' : 'Weak');
const engineStatus = (v: number) => (v >= 70 ? 'Full thrust' : v >= 40 ? 'Cruising' : 'Idling');

export function ControlUI() {
  const power = useStore((s) => s.power);
  const sw = useStore((s) => s.sw);
  const temp = useStore((s) => s.reactorTemp);
  const log = useStore((s) => s.log);
  const identified = useStore((s) => s.identified);
  const busy = useStore((s) => s.transitioning);
  const setPower = useStore((s) => s.setPower);
  const toggleSwitch = useStore((s) => s.toggleSwitch);
  const addLog = useStore((s) => s.addLog);
  const identify = useStore((s) => s.identify);
  const ping = useStore((s) => s.ping);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const range = rangeOf(power.sensors, sw.deepScan);
  const detected = CONTACTS.filter((c) => isDetected(c, range, sw.deepScan));
  const selected = detected.find((c) => c.id === selectedId) ?? null;
  const total = totalPower(power);
  const capped = total >= BUDGET;
  const diag = diagnostics(power, sw, temp);
  const target = Math.round(reactorTarget(power, sw));

  // ---- reactor: one loop eases the temperature toward its target and writes the store about ten times a second
  const sim = useRef({ temp: useStore.getState().reactorTemp, last: 0, warned: false, capped: false });

  const cutoff = (auto: boolean) => {
    const st = useStore.getState();
    const before = sim.current.temp;
    st.emergencyCutoff();
    HEAT_SWITCHES.forEach((k) => {
      if (useStore.getState().sw[k]) st.toggleSwitch(k);
    });
    const next = Math.min(before, 60);
    sim.current.temp = next;
    sim.current.warned = false;
    st.setReactorTemp(Math.round(next));
    audio.play(auto ? 'alert' : 'off');
    if (auto) {
      st.addLog('Emergency cutoff. Power reset to 50 for every system. Stealth, deep scan and the beacon are off.', 'warn');
      st.showToast('Reactor reached the limit. Emergency cutoff has reset the ship systems.', 'warn');
    } else {
      st.addLog('Manual emergency cutoff. Power reset to 50 for every system. Stealth, deep scan and the beacon are off.', 'warn');
    }
  };

  useRaf((dt, now) => {
    const st = useStore.getState();
    const sm = sim.current;
    const goal = reactorTarget(st.power, st.sw);
    sm.temp += (goal - sm.temp) * (1 - Math.exp(-dt * 0.45));

    if (sm.temp >= CUTOFF_TEMP) {
      cutoff(true);
      return;
    }
    if (sm.temp >= WARN_TEMP && !sm.warned) {
      sm.warned = true;
      audio.play('alert');
      st.addLog(`Reactor at ${Math.round(sm.temp)} degrees. Lower engine or shield power, or switch the stabilizers on.`, 'warn');
      st.showToast('Reactor temperature is high. Reduce power or switch the stabilizers on.', 'warn');
    } else if (sm.temp < WARN_TEMP - 4 && sm.warned) {
      sm.warned = false;
      st.addLog('Reactor temperature is back in the safe range.', 'ok');
    }

    const rounded = Math.round(sm.temp);
    if (now - sm.last >= 0.1 && rounded !== Math.round(st.reactorTemp)) {
      sm.last = now;
      st.setReactorTemp(rounded);
    }
  });

  // ---- handlers
  const onPower = (key: (typeof SYSTEMS)[number]['key'], value: number) => {
    const st = useStore.getState();
    const next = applyPower(key, value, st.power);
    setPower(key, next[key]);
    useStore.setState((s) => ({ power: { ...s.power, ...next } }));
    const drawn = (Object.keys(next) as (keyof typeof next)[]).some((k) => k !== key && next[k] !== st.power[k]);
    const nowCapped = drawn;
    if (nowCapped && !sim.current.capped) {
      addLog('The shared power budget is full. Other systems are drawing down as you raise this one.', 'info');
    }
    sim.current.capped = totalPower(next) >= BUDGET;
  };

  const onSwitch = (key: SwitchKey) => {
    const def = SWITCHES.find((s) => s.key === key)!;
    const turningOn = !useStore.getState().sw[key];
    toggleSwitch(key);
    addLog(turningOn ? def.on : def.off, turningOn ? 'ok' : 'info');
  };

  const doPing = () => {
    audio.play('ping');
    ping();
    const inReach = CONTACTS.filter((c) => isDetected(c, range, sw.deepScan)).length;
    addLog(
      sw.stealth
        ? `Active ping sent. Stealth mode is on, so the reply is weak. ${plural(inReach, 'contact', 'contacts')} in reach.`
        : `Active ping sent. ${plural(inReach, 'contact', 'contacts')} in reach.`,
      'info',
    );
  };

  const doIdentify = () => {
    if (!selected || identified.includes(selected.id)) return;
    audio.play('confirm');
    identify(selected.id);
    addLog(`${selected.name} identified as ${selected.kind.toLowerCase()}.`, 'ok');
  };

  const pick = (id: string) => {
    audio.play('select');
    setSelectedId(id);
  };

  const gaugeTone = temp >= WARN_TEMP ? 'warn' : temp >= 65 ? 'violet' : 'cyan';
  const hidden = CONTACTS.length - detected.length;
  const newest = [...log].reverse();

  const diagRows: { key: string; label: string; value: number; word: string; bad: boolean }[] = [
    { key: 'hull', label: 'Hull', value: diag.hull, word: hullStatus(diag.hull), bad: diag.hull < 50 },
    { key: 'shield', label: 'Shields', value: diag.shield, word: shieldStatus(diag.shield), bad: diag.shield < 40 },
    { key: 'engine', label: 'Engines', value: diag.engine, word: engineStatus(diag.engine), bad: false },
    { key: 'signal', label: 'Signal', value: diag.signal, word: signalStatus(diag.signal), bad: false },
    { key: 'life', label: 'Life support', value: diag.life, word: lifeStatus(diag.life), bad: diag.life < 45 },
  ];

  return (
    <section className="scene-ui ctl-ui" aria-label="Control center">
      <div className="ctl-scroll">
        <header className="ctl-head">
          <SceneTitle n="05" name="Control center" sub="Ship systems" />
          <Button
            variant="primary"
            size="lg"
            disabled={busy}
            iconAfter={<ArrowRight size={20} weight="bold" />}
            onClick={() => goTo('core')}
          >
            Stabilize the core
          </Button>
        </header>

        <div className="ctl-grid">
          <div className="ctl-col ctl-col-a">
            <Panel eyebrow="Power" title="Systems" index={1} className="ctl-power">
              <div className="ctl-budget">
                <div className="ctl-budget-head">
                  <span className="caption-4 ctl-muted">Shared budget</span>
                  <span className="mono caption-4">
                    {total} of {BUDGET}
                  </span>
                </div>
                <Meter value={total / BUDGET} tone={capped ? 'warn' : 'cyan'} label="Power budget used" />
                <p className="caption-5 ctl-faint">{capped ? 'The budget is full. Raising one system draws the others down.' : 'Raise any system until the budget is full.'}</p>
              </div>
              <div className="ctl-sliders">
                {SYSTEMS.map((sys) => (
                  <div key={sys.key} className="ctl-slider">
                    <Range
                      label={sys.label}
                      value={power[sys.key]}
                      min={0}
                      max={100}
                      onChange={(v) => onPower(sys.key, v)}
                      onTick={() => audio.play('tick')}
                      format={(v) => `${v}`}
                      tone={sys.key === 'shields' ? 'violet' : 'cyan'}
                    />
                    <p className="caption-5 ctl-faint">{sys.hint}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel eyebrow="Reactor" title="Temperature" index={2} className={`ctl-reactor ${temp >= CUTOFF_TEMP - 6 ? 'is-critical' : ''}`}>
              <div className="ctl-temp-row">
                <p className="heading-4 mono ctl-temp" aria-live="off">
                  {temp}
                  <span className="caption-3"> °C</span>
                </p>
                <p className={`body-5 ctl-temp-status ${temp >= WARN_TEMP ? 'is-hot' : ''}`}>
                  <Thermometer size={16} weight="bold" /> {tempStatus(temp)}
                </p>
              </div>
              <div className="ctl-gauge">
                <Meter value={temp / GAUGE_MAX} tone={gaugeTone} label="Reactor temperature" />
                <span className="ctl-mark" style={{ left: `${(WARN_TEMP / GAUGE_MAX) * 100}%` }} aria-hidden />
                <span className="ctl-mark ctl-mark-limit" style={{ left: `${(CUTOFF_TEMP / GAUGE_MAX) * 100}%` }} aria-hidden />
              </div>
              <p className="caption-5 ctl-faint">
                Heading for {target} °C. Warning at {WARN_TEMP}, automatic cutoff at {CUTOFF_TEMP}.
              </p>
              <Button className="btn-danger" icon={<Power size={18} weight="bold" />} onClick={() => cutoff(false)} sound={null}>
                Emergency cutoff
              </Button>
              <p className="caption-5 ctl-faint">Resets every system to 50 and switches off stealth, deep scan and the beacon.</p>
            </Panel>
          </div>

          <div className="ctl-col ctl-col-b">
            <Panel eyebrow="Radar" title={`Reach ${Math.round(range * 4800)} km`} index={1} className="ctl-radar-panel">
              <div className="ctl-radar-wrap">
                <Radar selectedId={selected?.id ?? null} onPick={pick} />
              </div>
              <div className="ctl-radar-bar">
                <p className="body-6 ctl-muted">
                  {plural(detected.length, 'contact', 'contacts')} in reach
                  {hidden > 0 ? `. ${hidden} beyond range.` : '.'}
                </p>
                <Button size="sm" icon={<Broadcast size={16} weight="bold" />} onClick={doPing} sound={null}>
                  Ping
                </Button>
              </div>
            </Panel>

            <Panel eyebrow="Contacts" title={selected ? selected.name : 'Select a contact'} index={2} className="ctl-contacts">
              {selected ? (
                <div className="ctl-detail">
                  <p className="caption-4 ctl-muted">
                    {selected.kind} · {contactDistance(selected)}
                  </p>
                  <p className="body-6">{selected.desc}</p>
                  {identified.includes(selected.id) ? (
                    <p className="body-5 ctl-ok">
                      <CheckCircle size={16} weight="bold" /> Identified
                    </p>
                  ) : (
                    <Button variant="primary" size="sm" icon={<Crosshair size={16} weight="bold" />} onClick={doIdentify} sound={null}>
                      Identify
                    </Button>
                  )}
                </div>
              ) : (
                <p className="body-6 ctl-muted ctl-empty">Tap a dot on the radar or choose a contact below to read its signal.</p>
              )}
              {detected.length > 0 ? (
                <ul className="ctl-contact-list" aria-label="Contacts in reach">
                  {detected.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`ctl-contact ${selected?.id === c.id ? 'is-active' : ''}`}
                        aria-pressed={selected?.id === c.id}
                        onClick={() => pick(c.id)}
                        onPointerEnter={() => audio.play('hover')}
                      >
                        <span className="body-6">{c.name}</span>
                        <span className="caption-4 ctl-faint">{identified.includes(c.id) ? 'Identified' : contactDistance(c)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="body-6 ctl-muted ctl-empty">Nothing in reach. Raise sensor power or switch on deep scan.</p>
              )}
            </Panel>
          </div>

          <div className="ctl-col ctl-col-c">
            <Panel eyebrow="Modes" title="Switches" index={1} className="ctl-switches">
              <div className="ctl-switch-list">
                {SWITCHES.map((s) => (
                  <Switch key={s.key} checked={sw[s.key]} onChange={() => onSwitch(s.key)} label={s.label} hint={s.hint} />
                ))}
              </div>
            </Panel>

            <Panel eyebrow="Diagnostics" title="Ship status" index={2} className="ctl-diag">
              <ul className="ctl-diag-list">
                {diagRows.map((d) => (
                  <li key={d.key}>
                    <div className="ctl-diag-head">
                      <span className="body-6">{d.label}</span>
                      <span className={`caption-4 mono ${d.bad ? 'ctl-bad' : 'ctl-muted'}`}>
                        {d.word} · {d.value}
                      </span>
                    </div>
                    <Meter value={d.value / 100} tone={d.bad ? 'warn' : d.key === 'shield' ? 'violet' : 'cyan'} label={d.label} />
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel eyebrow="Log" title="System log" index={3} className="ctl-log">
              {newest.length === 0 ? (
                <p className="body-6 ctl-muted ctl-empty">No events yet. Change a setting and it will appear here.</p>
              ) : (
                <ol className="ctl-log-list" aria-live="polite" aria-label="System log, newest first">
                  {newest.map((e) => (
                    <li key={e.id} className={`ctl-log-item is-${e.tone}`}>
                      <span className="mono caption-4 ctl-faint">{fmtTime(clamp(e.t, 0, 5999))}</span>
                      <span className="body-6">{e.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </section>
  );
}
