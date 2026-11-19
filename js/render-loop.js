// Keep elapsed time between frame timestamps; only reset after a real idle period.
export function createRenderLoop(render, {
  request = callback => requestAnimationFrame(callback),
  cancel = id => cancelAnimationFrame(id),
  now = () => performance.now(),
  enabled = () => true,
} = {}) {
  let pending = null, previous = null;
  function tick(time) {
    pending = null;
    if (!enabled()) { previous = null; return; }
    const elapsed = Math.max(0, (time - previous) / 1000);
    previous = time;
    if (render(Math.min(elapsed, .05), elapsed) && enabled()) pending = request(tick);
    else previous = null;
  }
  return {
    wake() {
      if (pending !== null || !enabled()) return;
      previous = now(); pending = request(tick);
    },
    stop() {
      if (pending !== null) cancel(pending);
      pending = null; previous = null;
    },
  };
}
