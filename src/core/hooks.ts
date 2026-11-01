import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';

/** Distance multiplier so scenes fit narrow and portrait screens. 1 on wide screens. */
export function useFit() {
  const size = useThree((s) => s.size);
  const aspect = size.width / size.height;
  if (aspect < 0.62) return 1.9;
  if (aspect < 0.85) return 1.55;
  if (aspect < 1.15) return 1.25;
  return 1;
}

export function useIsPortrait() {
  const size = useThree((s) => s.size);
  return size.width / size.height < 0.85;
}

/** Runs a callback every animation frame from the DOM side, without causing React renders. */
export function useRaf(cb: (dt: number, t: number) => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      ref.current(dt, now / 1000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}

/** Media query hook for the overlay layer */
export function useMedia(query: string) {
  const [match, setMatch] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}
