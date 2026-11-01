import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useRaf } from '../../core/hooks';
import { useStore } from '../../core/store';
import { prefersReducedMotion } from '../../core/util';
import { CONTACTS, FAR, TAU, isDetected, rangeOf } from './sim';

const TRAIL = 22;
const DASH = [4, 6];
const NODASH: number[] = [];
const CYAN = '#27d8f2';
const ICE = '#e8f6ff';
const OK = '#38f0c8';
const WARN = '#ffb35c';
const VIOLET = '#9a82ff';
const TONE: Record<string, string> = { info: ICE, warn: WARN, violet: VIOLET };

interface Props {
  selectedId: string | null;
  onPick: (id: string) => void;
}

/** 2D radar: sweep, range rings, orbiting contacts. Reads the store each frame and allocates nothing. */
export function Radar({ selectedId, onPick }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const box = useRef({ w: 0, h: 0, dpr: 1, font: '' });
  const live = useRef({ pings: useStore.getState().pings, pingAt: -100 });
  const sel = useRef(selectedId);
  sel.current = selectedId;
  const reduce = useRef(prefersReducedMotion());

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    ctxRef.current = el.getContext('2d');
    const apply = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (el.width !== w) el.width = w;
      if (el.height !== h) el.height = h;
      box.current = { w, h, dpr, font: `500 ${Math.round(11 * dpr)}px "Geist Mono Variable", ui-monospace, monospace` };
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useRaf((_, t) => {
    const ctx = ctxRef.current;
    const { w, h, dpr, font } = box.current;
    if (!ctx || w < 2) return;
    const lv = live.current;
    const s = useStore.getState();
    const deep = s.sw.deepScan;
    const range = rangeOf(s.power.sensors, deep);
    if (s.pings !== lv.pings) {
      lv.pings = s.pings;
      lv.pingAt = t;
    }
    const reduced = reduce.current;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) / 2 - 10 * dpr;
    const sweep = (t * (reduced ? 0.4 : 1.0)) % TAU;

    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.setLineDash(NODASH);

    // disc and the part beyond sensor reach
    ctx.fillStyle = 'rgba(7,11,24,0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    if (range < 0.999) {
      ctx.fillStyle = 'rgba(24,43,85,0.34)';
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.moveTo(cx + range * R, cy);
      ctx.arc(cx, cy, range * R, 0, TAU, true);
      ctx.fill('evenodd');
    }

    // rings and cross
    ctx.lineWidth = dpr;
    ctx.strokeStyle = 'rgba(160,190,255,0.18)';
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (R * k) / 4, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.stroke();

    // reach edge
    ctx.strokeStyle = CYAN;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, range * R, 0, TAU);
    ctx.stroke();

    // sweep trail
    ctx.fillStyle = CYAN;
    for (let i = 0; i < TRAIL; i++) {
      ctx.globalAlpha = 0.26 * (1 - i / TRAIL);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, range * R, sweep - (i + 1) * 0.045, sweep - i * 0.045);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * range * R, cy + Math.sin(sweep) * range * R);
    ctx.stroke();

    // ping pulse
    const pp = (t - lv.pingAt) / 1.8;
    if (pp >= 0 && pp < 1) {
      ctx.globalAlpha = 0.8 * (1 - pp);
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, pp * range * R, 0, TAU);
      ctx.stroke();
    }

    // contacts
    ctx.font = font;
    ctx.textBaseline = 'middle';
    for (let i = 0; i < CONTACTS.length; i++) {
      const c = CONTACTS[i];
      if (!isDetected(c, range, deep)) continue;
      const a = c.a0 + c.speed * t;
      const x = cx + Math.cos(a) * c.r * R;
      const y = cy + Math.sin(a) * c.r * R;
      let diff = (sweep - a) % TAU;
      if (diff < 0) diff += TAU;
      let b = reduced ? 0.8 : Math.exp(-diff * 0.75);
      const sincePing = t - lv.pingAt;
      if (sincePing >= 0 && sincePing < 5) b = Math.max(b, 1 - sincePing / 5);
      const known = s.identified.includes(c.id);
      const alpha = (0.22 + 0.78 * b) * (c.r >= FAR ? 0.75 : 1);
      const color = known ? OK : TONE[c.tone];
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha * 0.25;
      ctx.beginPath();
      ctx.arc(x, y, c.size * dpr * (1.8 + 1.6 * b), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, c.size * dpr, 0, TAU);
      ctx.fill();
      if (sel.current === c.id) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = ICE;
        ctx.lineWidth = dpr;
        ctx.beginPath();
        ctx.arc(x, y, (c.size + 6) * dpr, 0, TAU);
        ctx.stroke();
      }
      if (known) {
        ctx.globalAlpha = Math.max(0.6, alpha);
        ctx.fillStyle = ICE;
        const right = x > cx + R * 0.45;
        ctx.textAlign = right ? 'right' : 'left';
        ctx.fillText(c.name, x + (right ? -1 : 1) * (c.size + 8) * dpr, y - 9 * dpr);
      }
    }

    // the ship at the centre
    ctx.globalAlpha = 1;
    if (s.sw.stealth) {
      ctx.setLineDash(DASH);
      ctx.strokeStyle = VIOLET;
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, 13 * dpr, 0, TAU);
      ctx.stroke();
      ctx.setLineDash(NODASH);
    }
    if (s.sw.beacon) {
      const ph = (t * 0.8) % 1;
      ctx.globalAlpha = 1 - ph;
      ctx.strokeStyle = OK;
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, (8 + 26 * ph) * dpr, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = ICE;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7 * dpr);
    ctx.lineTo(cx + 5 * dpr, cy + 5 * dpr);
    ctx.lineTo(cx - 5 * dpr, cy + 5 * dpr);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  const hit = (e: ReactPointerEvent<HTMLCanvasElement>): string | null => {
    const el = canvas.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const R = Math.min(r.width, r.height) / 2 - 10;
    const cx = r.width / 2;
    const cy = r.height / 2;
    const t = performance.now() / 1000;
    const s = useStore.getState();
    const range = rangeOf(s.power.sensors, s.sw.deepScan);
    let best = -1;
    let bd = e.pointerType === 'touch' ? 30 : 20;
    for (let i = 0; i < CONTACTS.length; i++) {
      const c = CONTACTS[i];
      if (!isDetected(c, range, s.sw.deepScan)) continue;
      const a = c.a0 + c.speed * t;
      const d = Math.hypot(px - (cx + Math.cos(a) * c.r * R), py - (cy + Math.sin(a) * c.r * R));
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best >= 0 ? CONTACTS[best].id : null;
  };

  return (
    <canvas
      ref={canvas}
      className="ctl-radar-canvas"
      role="img"
      aria-label="Radar display. Use the contact list below it to inspect objects with the keyboard."
      onPointerDown={(e) => {
        const id = hit(e);
        if (id) onPick(id);
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'touch' || !canvas.current) return;
        canvas.current.style.cursor = hit(e) ? 'pointer' : 'default';
      }}
    />
  );
}
