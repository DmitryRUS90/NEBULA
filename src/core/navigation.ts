import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { audio } from './audio';
import { applyTint, fx, overlayRefs } from './fx';
import { sceneDef, sceneIndex, SCENES, type SceneId } from './scenes';
import { useStore } from './store';
import { prefersReducedMotion } from './util';
import { WORLDS } from '../data/worlds';

gsap.registerPlugin(CustomEase);
CustomEase.create('nebula', '0.22,1,0.36,1');

function sceneTint(id: SceneId) {
  const def = sceneDef(id);
  if (id === 'worlds') {
    const w = WORLDS[useStore.getState().world];
    return { ...def, tint: w.tint };
  }
  return def;
}

function commit(target: SceneId) {
  const def = sceneDef(target);
  useStore.getState().commitScene(target);
  fx.baseFov = def.baseFov;
  fx.portalOpen = 0;
  fx.dolly = 0;
  fx.cruise = def.cruise;
  applyTint(sceneTint(target), 1.8);
  audio.setScene(target);
}

/** Cinematic move to another scene: letterbox, warp, flash, swap, settle. */
export function goTo(target: SceneId) {
  const s = useStore.getState();
  if (s.transitioning || s.scene === target) return;
  s.beginTransition(target);
  const { top, bottom, flash } = overlayRefs;

  if (prefersReducedMotion() || !top || !bottom || !flash) {
    const tl = gsap.timeline({ onComplete: () => useStore.getState().endTransition() });
    if (flash) tl.to(flash, { opacity: 1, duration: 0.25, ease: 'nebula' });
    tl.add(() => commit(target));
    if (flash) tl.to(flash, { opacity: 0, duration: 0.4, ease: 'nebula' });
    return;
  }

  audio.play('warp');
  const forward = sceneIndex(target) > sceneIndex(s.scene);
  const tl = gsap.timeline({ onComplete: () => useStore.getState().endTransition() });
  const preOpen = s.scene === 'portal' && s.portalOpening ? 1.3 : 0;

  if (preOpen) {
    // the portal is already opening: let it flood the screen before the warp takes over
    tl.to(fx, { portalOpen: 1, dolly: 1, duration: 1.3, ease: 'power3.in' }, 0);
  }
  const t0 = preOpen * 0.7;
  tl.to(top, { yPercent: 0, duration: 0.6, ease: 'nebula' }, t0)
    .to(bottom, { yPercent: 0, duration: 0.6, ease: 'nebula' }, t0)
    .to(fx, { warp: 1, duration: 0.9, ease: 'power2.in' }, t0)
    .to(fx, { fovKick: forward ? 24 : -8, duration: 0.9, ease: 'power2.in' }, t0)
    .to(flash, { opacity: 1, duration: 0.28, ease: 'power2.in' }, t0 + 0.7)
    .add(() => commit(target), t0 + 1.0)
    .to(flash, { opacity: 0, duration: 1.0, ease: 'nebula' }, t0 + 1.05)
    .to(fx, { warp: 0, duration: 1.5, ease: 'power3.out' }, t0 + 1.05)
    .to(fx, { fovKick: 0, duration: 1.3, ease: 'nebula' }, t0 + 1.05)
    .to(top, { yPercent: -100, duration: 0.8, ease: 'nebula' }, t0 + 1.5)
    .to(bottom, { yPercent: 100, duration: 0.8, ease: 'nebula' }, t0 + 1.5);
}

export function nextScene(from: SceneId): SceneId {
  const i = sceneIndex(from);
  return SCENES[Math.min(SCENES.length - 1, i + 1)].id;
}

/** Portal button: opens the portal, then flies into the galaxy. */
export function enterPortal() {
  const s = useStore.getState();
  if (s.transitioning) return;
  audio.start();
  audio.setEnabled(s.sound);
  audio.setScene('portal');
  audio.play('confirm');
  s.setEntered();
  s.setPortalOpening(true);
  goTo('galaxy');
}

/** Final scene button: reset everything and go back to the portal. */
export function startNewExploration() {
  const s = useStore.getState();
  if (s.transitioning) return;
  s.beginTransition('portal');
  const { top, bottom, flash } = overlayRefs;
  audio.play('warp');
  const done = () => {
    useStore.getState().resetJourney();
    // the reset clears the transition flag, keep the interface locked until the animation ends
    useStore.setState({ transitioning: true, pending: 'portal' });
    fx.baseFov = sceneDef('portal').baseFov;
    fx.cruise = sceneDef('portal').cruise;
    fx.portalOpen = 0;
    fx.dolly = 0;
    applyTint(sceneDef('portal'), 1.8);
    audio.setScene('portal');
  };
  const finish = () => useStore.getState().endTransition();
  if (prefersReducedMotion() || !top || !bottom || !flash) {
    const quick = gsap.timeline({ onComplete: finish });
    if (flash) quick.to(flash, { opacity: 1, duration: 0.25 });
    quick.add(done);
    if (flash) quick.to(flash, { opacity: 0, duration: 0.4 });
    return;
  }
  gsap
    .timeline({ onComplete: finish })
    .to(top, { yPercent: 0, duration: 0.6, ease: 'nebula' }, 0)
    .to(bottom, { yPercent: 0, duration: 0.6, ease: 'nebula' }, 0)
    .to(fx, { warp: 1, duration: 0.9, ease: 'power2.in' }, 0)
    .to(flash, { opacity: 1, duration: 0.28, ease: 'power2.in' }, 0.7)
    .add(done, 1.0)
    .to(flash, { opacity: 0, duration: 1.0, ease: 'nebula' }, 1.05)
    .to(fx, { warp: 0, duration: 1.5, ease: 'power3.out' }, 1.05)
    .to(top, { yPercent: -100, duration: 0.8, ease: 'nebula' }, 1.5)
    .to(bottom, { yPercent: 100, duration: 0.8, ease: 'nebula' }, 1.5);
}
