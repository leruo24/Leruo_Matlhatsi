// Exact critically damped spring: stable at different display refresh rates.
export function spring(state, target, speed, dt) {
  if (dt <= 0) return state.x;
  const offset = state.x - target;
  const impulse = state.v + speed * offset;
  const decay = Math.exp(-speed * dt);
  state.x = target + (offset + impulse * dt) * decay;
  state.v = (state.v - speed * impulse * dt) * decay;
  return state.x;
}

export const blend = (speed, dt) => -Math.expm1(-speed * dt);

// Sustained overload lowers resolution; recovery needs longer stable headroom.
// Ignore interruptions so returning to a tab does not permanently blur the view.
export class FrameBudget {
  /** minimum: the lowest pixel ratio it may drop to (kept at 1:1 or more so the view stays sharp) */
  constructor(maximum, initial = maximum, minimum = .6) {
    this.maximum = maximum; this.minimum = Math.min(minimum, maximum); this.scale = initial;
    this.sum = 0; this.count = 0;
  }
  /** Judged on the mean frame time over 3-second windows: a steady average under about 35 fps steps the
      resolution down, over 50 fps steps it back up. Hitches over 100 ms (a texture upload, a garbage
      collection, returning to the tab) are skipped, so a few slow frames never blur the view. */
  sample(dt) {
    if (!(dt > 0) || dt > .1) return this.scale;
    this.sum += dt; this.count++;
    if (this.sum >= 3) {
      const mean = this.sum / this.count; this.sum = 0; this.count = 0;
      const step = mean > .028 ? -.1 : mean < .02 ? .1 : 0;
      this.scale = Math.min(this.maximum, Math.max(this.minimum, this.scale + step));
    }
    return this.scale;
  }
}
