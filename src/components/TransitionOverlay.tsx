import gsap from 'gsap';
import { useLayoutEffect, useRef } from 'react';
import { overlayRefs } from '../core/fx';

/**
 * Letterbox bars and a flash. The navigation timeline drives them through overlayRefs,
 * so React never re-renders during a transition.
 */
export function TransitionOverlay() {
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    overlayRefs.top = top.current;
    overlayRefs.bottom = bottom.current;
    overlayRefs.flash = flash.current;
    gsap.set(top.current, { yPercent: -100 });
    gsap.set(bottom.current, { yPercent: 100 });
    gsap.set(flash.current, { opacity: 0 });
    return () => {
      overlayRefs.top = overlayRefs.bottom = overlayRefs.flash = null;
    };
  }, []);

  return (
    <div className="transition-layer" aria-hidden>
      <div ref={top} className="letterbox letterbox-top" />
      <div ref={bottom} className="letterbox letterbox-bottom" />
      <div ref={flash} className="flash" />
    </div>
  );
}
