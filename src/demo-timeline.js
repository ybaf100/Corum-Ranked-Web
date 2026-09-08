// A finite presentation clock. Time advances only while its scene is visible.
export function createDemoTimeline({ steps, duration, onFrame, onState = () => {}, requestFrame, cancelFrame }) {
  if (!Number.isInteger(steps) || steps < 2 || !Number.isFinite(duration) || duration <= 0) throw new RangeError("Invalid demo timeline");
  let elapsed = 0;
  let previousTime = null;
  let scheduled = null;
  let index = 0;
  let state = "idle";
  let visible = false;
  let pageVisible = true;
  let reduced = false;
  let complete = false;
  let disposed = false;

  const emitState = (next) => { if (state !== next) { state = next; onState(next); } };
  const emitFrame = (next) => { if (index !== next) { index = next; onFrame(next); } };
  const stop = () => {
    if (scheduled !== null) cancelFrame(scheduled);
    scheduled = null;
    previousTime = null;
  };
  const canRun = () => !disposed && !reduced && !complete && visible && pageVisible;
  const tick = (now) => {
    scheduled = null;
    if (!canRun()) return;
    if (previousTime !== null) elapsed = Math.min(duration, elapsed + Math.max(0, now - previousTime));
    previousTime = now;
    emitFrame(Math.min(steps - 1, Math.floor(elapsed * steps / duration)));
    if (elapsed >= duration) {
      complete = true;
      previousTime = null;
      emitState("complete");
      return;
    }
    scheduled = requestFrame(tick);
  };
  const reconcile = () => {
    stop();
    if (disposed) return;
    if (reduced) emitState("static");
    else if (complete) emitState("complete");
    else if (canRun()) { emitState("playing"); scheduled = requestFrame(tick); }
    else emitState(elapsed > 0 ? "paused" : "idle");
  };
  onFrame(0);
  onState("idle");
  return {
    setVisible(value) { if (disposed || visible === value) return; visible = value; reconcile(); },
    setPageVisible(value) { if (disposed || pageVisible === value) return; pageVisible = value; reconcile(); },
    setReduced(value) {
      if (disposed || reduced === value) return;
      reduced = value;
      if (reduced) { elapsed = duration; complete = true; emitFrame(steps - 1); }
      reconcile();
    },
    replay() {
      if (disposed || reduced) return;
      elapsed = 0;
      complete = false;
      emitFrame(0);
      reconcile();
    },
    dispose() { disposed = true; stop(); },
  };
}
