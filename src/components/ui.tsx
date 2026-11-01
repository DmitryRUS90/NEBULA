import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { audio, type Sfx } from '../core/audio';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconAfter?: ReactNode;
  sound?: Sfx | null;
};

export function Button({
  variant = 'ghost',
  size = 'md',
  icon,
  iconAfter,
  sound = 'click',
  className = '',
  onClick,
  onPointerEnter,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} button-${size} ${className}`}
      onClick={(e) => {
        if (sound) audio.play(sound);
        onClick?.(e);
      }}
      onPointerEnter={(e) => {
        if (!rest.disabled) audio.play('hover');
        onPointerEnter?.(e);
      }}
      {...rest}
    >
      {icon}
      {children && <span>{children}</span>}
      {iconAfter}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = '',
  onClick,
  sound = 'click',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; sound?: Sfx | null }) {
  return (
    <button
      type="button"
      className={`btn btn-icon ${className}`}
      aria-label={label}
      title={label}
      onClick={(e) => {
        if (sound) audio.play(sound);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

const rise = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

/** Glass panel. Rises into place when it mounts. */
export function Panel({
  title,
  eyebrow,
  children,
  className = '',
  index = 0,
  style,
  as = 'section',
  label,
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  index?: number;
  style?: CSSProperties;
  as?: 'section' | 'aside' | 'div';
  label?: string;
}) {
  const Tag = motion[as];
  return (
    <Tag className={`panel ${className}`} variants={rise} initial="hidden" animate="show" custom={index} style={style} aria-label={label ?? title}>
      {(title || eyebrow) && (
        <header className="panel-head">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          {title && <h2 className="panel-title title-2">{title}</h2>}
        </header>
      )}
      {children}
    </Tag>
  );
}

export function Meter({ value, tone = 'cyan', label, className = '' }: { value: number; tone?: 'cyan' | 'violet' | 'warn' | 'ok'; label?: string; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`meter meter-${tone} ${className}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <span style={{ transform: `scaleX(${v})` }} />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch ${checked ? 'is-on' : ''}`}
      onClick={() => {
        audio.play(checked ? 'off' : 'on');
        onChange(!checked);
      }}
      onPointerEnter={() => audio.play('hover')}
    >
      <span className="switch-text">
        <span className="switch-label body-6">{label}</span>
        {hint && <span className="switch-hint caption-4">{hint}</span>}
      </span>
      <span className="switch-track" aria-hidden>
        <span className="switch-thumb" />
      </span>
    </button>
  );
}

export function Range({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format,
  tone,
  onTick,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
  tone?: 'cyan' | 'violet' | 'warn';
  onTick?: () => void;
}) {
  const pct = (value - min) / (max - min);
  return (
    <label className={`range range-${tone ?? 'cyan'}`}>
      <span className="range-head">
        <span className="range-label caption-4">{label}</span>
        <span className="range-value mono caption-4">{format ? format(value) : value}</span>
      </span>
      <span className="range-track">
        <span className="range-rail" aria-hidden />
        <span className="range-fill" aria-hidden style={{ transform: `scaleX(${pct})` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            onTick?.();
            onChange(Number(e.target.value));
          }}
        />
      </span>
    </label>
  );
}

/** Every word fades from a muted tone to full colour in reading order. */
export function WordReveal({ text, active, step = 0.12, className = '' }: { text: string; active: boolean; step?: number; className?: string }) {
  const words = text.split(' ');
  return (
    <span className={`word-reveal ${active ? 'is-active' : ''} ${className}`} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="word" aria-hidden style={{ transitionDelay: `${i * step}s` }}>
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

/** Title card that appears when a scene starts */
export function SceneTitle({ n, name, sub }: { n: string; name: string; sub: string }) {
  return (
    <div className="scene-title">
      <p className="mono caption-4 scene-title-n">{n}</p>
      <h2 className="heading-5 grad-text scene-title-name">{name}</h2>
      <p className="eyebrow">{sub}</p>
    </div>
  );
}
