import { constrainFlight } from './drone-control.js';
// Rates are photo-space units per second; clamp elapsed time after interruptions.
// `constrain` keeps the drone in its zone (the main experience's patch of sky by default) and
// `rate` scales the speed (the 360 view flies faster: its sky is much bigger).
export function advanceRemote(state, axes, dt, constrain = constrainFlight, rate = 1) {
  const seconds = Math.max(0, Math.min(.05, Number.isFinite(dt) ? dt : 0));
  const axis = n => Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
  return constrain(state.x + axis(axes.x) * 160 * rate * seconds,
    state.y + axis(axes.y) * 45 * rate * seconds,
    state.angle + axis(axes.bank) * .9 * seconds);
}
