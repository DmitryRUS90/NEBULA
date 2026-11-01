import type { SceneId } from './scenes';

export type Sfx =
  | 'click'
  | 'hover'
  | 'select'
  | 'on'
  | 'off'
  | 'confirm'
  | 'warp'
  | 'scan'
  | 'alert'
  | 'success'
  | 'fail'
  | 'ping'
  | 'tick';

/** Pad root note per scene, in hertz */
const ROOTS: Record<SceneId, number> = {
  portal: 110,
  galaxy: 98,
  worlds: 82.4,
  laboratory: 123.5,
  control: 110,
  core: 130.8,
  beyond: 146.8,
};

/**
 * Fully procedural audio: no files to load. The context is created only after a user gesture
 * and everything can be muted with one switch.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private pad: OscillatorNode[] = [];
  private padRatios = [1, 1.5, 2];
  private enabled = true;
  private started = false;
  private lastHover = 0;
  private noiseBuf: AudioBuffer | null = null;
  private currentScene: SceneId = 'portal';

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.08);
  }

  /** Call from a click or key handler. Safe to call repeatedly. */
  start() {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.8;
    this.sfx.connect(this.master);
    this.master.connect(comp);
    comp.connect(ctx.destination);

    const amb = ctx.createGain();
    amb.gain.value = 0;
    amb.connect(this.master);
    amb.gain.setTargetAtTime(0.55, ctx.currentTime, 2.5);

    // low drone
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 320;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.5;
    [55, 55.4, 82.4].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.25 : 0.5;
      o.connect(g).connect(droneFilter);
      o.start();
    });
    droneFilter.connect(droneGain).connect(amb);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 110;
    lfo.connect(lfoGain).connect(droneFilter.frequency);
    lfo.start();

    // slow pad
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.06;
    this.padRatios.forEach((r, i) => {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = ROOTS[this.currentScene] * r;
        o.detune.value = det + i * 2;
        o.connect(padFilter);
        o.start();
        this.pad.push(o);
      }
    });
    padFilter.connect(padGain).connect(amb);
    const padLfo = ctx.createOscillator();
    padLfo.frequency.value = 0.045;
    const padLfoGain = ctx.createGain();
    padLfoGain.gain.value = 0.03;
    padLfo.connect(padLfoGain).connect(padGain.gain);
    padLfo.start();

    // air
    this.noiseBuf = this.makeNoise(2);
    const air = ctx.createBufferSource();
    air.buffer = this.noiseBuf;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 900;
    airFilter.Q.value = 0.4;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.012;
    air.connect(airFilter).connect(airGain).connect(amb);
    air.start();

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });

    this.started = true;
    this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, ctx.currentTime, 0.4);
  }

  setScene(id: SceneId) {
    this.currentScene = id;
    if (!this.ctx) return;
    const root = ROOTS[id];
    const t = this.ctx.currentTime;
    this.pad.forEach((o, i) => {
      const ratio = this.padRatios[Math.floor(i / 2)];
      o.frequency.setTargetAtTime(root * ratio, t, 1.4);
    });
  }

  private makeNoise(seconds: number) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, f0: number, f1: number, vol: number, q = 1.2) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  play(name: Sfx) {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    switch (name) {
      case 'click':
        this.tone(880, 1320, 0.09, 'triangle', 0.16);
        break;
      case 'hover': {
        const now = performance.now();
        if (now - this.lastHover < 70) return;
        this.lastHover = now;
        this.tone(1900, 1900, 0.03, 'sine', 0.025);
        break;
      }
      case 'tick':
        this.tone(1400, 1400, 0.025, 'square', 0.03);
        break;
      case 'select':
        this.tone(520, 780, 0.14, 'sine', 0.2);
        this.tone(1040, 1560, 0.1, 'sine', 0.06, 0.03);
        break;
      case 'on':
        this.tone(660, 990, 0.12, 'triangle', 0.18);
        break;
      case 'off':
        this.tone(660, 440, 0.12, 'triangle', 0.16);
        break;
      case 'confirm':
        [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, f, 0.22, 'sine', 0.14, i * 0.07));
        break;
      case 'warp':
        this.noise(1.5, 200, 5200, 0.5, 0.8);
        this.tone(60, 240, 1.4, 'sawtooth', 0.07);
        break;
      case 'scan':
        this.tone(380, 1700, 1.2, 'sine', 0.1);
        this.tone(760, 3400, 1.2, 'sine', 0.03);
        break;
      case 'ping':
        this.tone(1200, 600, 0.6, 'sine', 0.16);
        break;
      case 'alert':
        this.tone(240, 240, 0.12, 'square', 0.08);
        this.tone(240, 240, 0.12, 'square', 0.08, 0.18);
        break;
      case 'success':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, f, 1.6 - i * 0.2, 'sine', 0.16, i * 0.12));
        this.noise(1.6, 400, 6000, 0.25, 0.7);
        break;
      case 'fail':
        this.tone(130, 38, 1.0, 'sine', 0.35);
        this.noise(0.8, 900, 120, 0.4, 0.6);
        break;
    }
  }
}

export const audio = new AudioEngine();
