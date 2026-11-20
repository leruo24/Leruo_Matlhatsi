import { constrainFlight } from './drone-control.js';
// Rates are photo-space units per second; clamp elapsed time after interruptions.
export function advanceRemote(state, axes, dt) {
  const seconds = Math.max(0, Math.min(.05, Number.isFinite(dt) ? dt : 0));
  const axis = n => Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
  return constrainFlight(state.x + axis(axes.x) * 160 * seconds,
    state.y + axis(axes.y) * 45 * seconds,
    state.angle + axis(axes.bank) * .9 * seconds);
}
