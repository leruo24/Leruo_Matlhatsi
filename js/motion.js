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
    if (!(dt > 0) || dt > .15) return this.scale;
    this.average += (dt - this.average) * blend(1.5, dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.slow = this.average > .023 ? this.slow + dt : 0;
    this.fast = this.average < .018 ? this.fast + dt : 0;
    if (this.cooldown === 0 && (this.slow > 2 || this.fast > 8)) {
      this.scale = Math.min(this.maximum, Math.max(Math.min(this.minimum, this.maximum), this.scale + (this.slow > 2 ? -.1 : .05)));
      this.cooldown = 3; this.slow = this.fast = 0;
    }
    return this.scale;
  }
}
