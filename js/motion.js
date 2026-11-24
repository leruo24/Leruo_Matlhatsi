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
  /** minimum: the lowest pixel ratio it may drop to (phones keep at least 1:1 so text and edges stay sharp) */
  constructor(maximum, initial = maximum, minimum = .6) {
    this.maximum = maximum; this.minimum = Math.min(minimum, maximum); this.scale = initial;
    this.average = 1 / 60; this.slow = 0; this.fast = 0; this.cooldown = 2;
  }
  sample(dt) {
    // hitches (a texture upload, a garbage collection, a screenshot) are skipped: only steady slowness counts
    if (!(dt > 0) || dt > .1) return this.scale;
    this.average += (dt - this.average) * blend(1.5, dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.slow = this.average > .028 ? this.slow + dt : 0;   // under about 35 fps for 3 s
    this.fast = this.average < .02 ? this.fast + dt : 0;    // over 50 fps for 3 s: sharpen again
    if (this.cooldown === 0 && (this.slow > 3 || this.fast > 3)) {
      this.scale = Math.min(this.maximum, Math.max(Math.min(this.minimum, this.maximum), this.scale + (this.slow > 3 ? -.1 : .1)));
      this.cooldown = 3; this.slow = this.fast = 0;
    }
    return this.scale;
  }
}
