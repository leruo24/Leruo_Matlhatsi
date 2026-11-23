import { OfficeMotion } from './office.js';
import { Sound } from './sound.js';

/**
 * The intro from the main experience, in front of the 3D workshop: a click to enter (so sound is
 * allowed), the busy black-and-white office photo with a VR headset on the desk, "Put on headset",
 * the view leaning in as the hands lift it, dark as the padding closes, then the workshop comes
 * into focus inside the lenses and the headset's edge falls away. Skip or Esc crossfades.
 * Reduced motion skips the animation; ?nointro skips the whole intro.
 */
export function createIntro({ view, onDone = () => {}, skip = false }) {
  const vr = document.querySelector('#vr');
  const $ = (s) => vr.querySelector(s);
  const sound = new Sound();
  const done = () => { vr.classList.add('gone'); document.body.classList.remove('vr'); view.style.filter = ''; onDone(sound); };
  if (skip) { done(); return { sound, active: false }; }
  document.body.classList.add('vr');
  const office = new OfficeMotion($('.vr-office'));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hands = $('.vr-hands'), black = $('.vr-black'), lens = $('.vr-lens'), welcome = $('.vr-welcome');
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const span = (t, a, b) => ease((t - a) / (b - a));
  let t0 = -1, finished = false, last = performance.now();
  view.style.filter = 'blur(10px) saturate(0.6)';
  function finish() { if (finished) return; finished = true; sound.nature = 1; done(); }
  function fade() {
    vr.classList.add('playing'); vr.style.transition = 'opacity .7s'; vr.style.opacity = '0';
    view.style.transition = 'filter .7s'; view.style.filter = '';
    sound.start(); sound.nature = 1; setTimeout(finish, 720);
  }
  function headset() {
    sound.start();
    if (reduced.matches) return fade();
    sound.headset(); vr.classList.add('playing'); t0 = performance.now();
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    sound.update(dt);
    if (!finished) office.draw(dt, true, reduced.matches);
    if (t0 >= 0 && !finished) {
      const t = (now - t0) / 1000;
      $('.vr-office').style.transform = `scale(${1.02 + 0.28 * span(t, 0, 1.0)})`;
      hands.style.opacity = span(t, 0.55, 0.85);
      hands.style.transform = `scale(${1.08 + 1.6 * span(t, 0.7, 2.25) ** 1.6})`;
      black.style.opacity = span(t, 1.6, 2.25) * (1 - span(t, 2.35, 2.8));
      if (t > 2.3) {
        $('.vr-office').style.visibility = hands.style.visibility = 'hidden';
        lens.style.opacity = 1 - span(t, 3.9, 4.55);
        lens.style.setProperty('--r', `${18 + 120 * span(t, 2.35, 4.45) ** 1.3}%`);
        view.style.filter = `blur(${(10 * (1 - span(t, 2.35, 3.9))).toFixed(2)}px) saturate(${(0.6 + 0.4 * span(t, 2.35, 3.6)).toFixed(2)})`;
        vr.style.background = 'transparent';
      }
      welcome.style.opacity = span(t, 2.9, 3.4) * (1 - span(t, 4.1, 4.55));
      sound.nature = span(t, 1.8, 4.4);
      if (t > 4.6) finish();
    }
    requestAnimationFrame(frame);   // keeps the farm ambience going after the intro
  }
  requestAnimationFrame(frame);
  vr.classList.add('gated');
  $('#vr-enter').onclick = (e) => {
    e.stopPropagation(); sound.start(); sound.nature = 0;
    $('.vr-gate').classList.add('out'); vr.classList.remove('gated');
    setTimeout(() => $('#vr-go').focus(), 900);
  };
  $('#vr-go').onclick = (e) => { e.stopPropagation(); headset(); };
  $('#vr-skip').onclick = (e) => { e.stopPropagation(); fade(); };
  const mute = $('#vr-mute');
  const syncMute = () => { mute.textContent = sound.enabled ? 'Sound on' : 'Sound off'; mute.setAttribute('aria-pressed', String(sound.enabled)); };
  syncMute();
  mute.onclick = (e) => { e.stopPropagation(); sound.start(); sound.toggle(); syncMute(); };
  addEventListener('keydown', (e) => { if (!finished && e.key === 'Escape') fade(); });
  return { sound, active: true };
}
