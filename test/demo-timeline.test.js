import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoTimeline } from "../src/demo-timeline.js";

function scene() {
  const queue = new Map();
  const frames = [];
  const states = [];
  let nextId = 1;
  const timeline = createDemoTimeline({ steps: 5, duration: 2500,
    onFrame: value => frames.push(value), onState: value => states.push(value),
    requestFrame: callback => { const id = nextId++; queue.set(id, callback); return id; },
    cancelFrame: id => queue.delete(id) });
  const tick = time => { const pending = [...queue.values()]; queue.clear(); pending.forEach(callback => callback(time)); };
  return { timeline, queue, frames, states, tick };
}

test("demo waits for visibility, completes once and replays only on request", () => {
  const s = scene();
  assert.equal(s.queue.size, 0);
  s.tick(10000);
  assert.deepEqual(s.frames, [0]);
  s.timeline.setVisible(true);
  s.tick(10000);
  for (let time = 10500; time <= 12500; time += 500) s.tick(time);
  assert.deepEqual(s.frames, [0, 1, 2, 3, 4]);
  assert.equal(s.states.at(-1), "complete");
  assert.equal(s.queue.size, 0);
  s.timeline.setVisible(false);
  s.timeline.setVisible(true);
  assert.equal(s.queue.size, 0);
  s.timeline.replay();
  assert.equal(s.frames.at(-1), 0);
  assert.equal(s.queue.size, 1);
  s.timeline.dispose();
});

test("offscreen and hidden-page time never skips the remaining scene", () => {
  const s = scene();
  s.timeline.setVisible(true);
  s.tick(0);
  s.tick(750);
  assert.equal(s.frames.at(-1), 1);
  s.timeline.setVisible(false);
  s.tick(50000);
  assert.equal(s.queue.size, 0);
  s.timeline.setVisible(true);
  s.tick(50000);
  assert.equal(s.frames.at(-1), 1);
  s.tick(50250);
  assert.equal(s.frames.at(-1), 2);
  s.timeline.setPageVisible(false);
  s.timeline.setVisible(false);
  s.timeline.setVisible(true);
  assert.equal(s.queue.size, 0);
  s.timeline.setPageVisible(true);
  s.tick(100000);
  assert.equal(s.frames.at(-1), 2);
  s.tick(100500);
  assert.equal(s.frames.at(-1), 3);
  s.timeline.dispose();
});

test("reduced motion immediately presents the final scene and cancels playback", () => {
  const s = scene();
  s.timeline.setVisible(true);
  s.tick(0);
  s.timeline.setReduced(true);
  assert.equal(s.frames.at(-1), 4);
  assert.equal(s.states.at(-1), "static");
  assert.equal(s.queue.size, 0);
  s.timeline.replay();
  assert.equal(s.frames.at(-1), 4);
  s.timeline.setReduced(false);
  assert.equal(s.queue.size, 0);
  s.timeline.replay();
  assert.equal(s.frames.at(-1), 0);
  assert.equal(s.queue.size, 1);
  s.timeline.dispose();
});

test("unmount cancels the clock and ignores stale callbacks and controls", () => {
  const s = scene();
  s.timeline.setVisible(true);
  const staleCallback = [...s.queue.values()][0];
  s.timeline.dispose();
  const framesBefore = [...s.frames];
  const statesBefore = [...s.states];
  staleCallback(50000);
  s.timeline.replay();
  s.timeline.setReduced(true);
  s.timeline.setVisible(false);
  s.timeline.setPageVisible(false);
  assert.deepEqual(s.frames, framesBefore);
  assert.deepEqual(s.states, statesBefore);
  assert.equal(s.queue.size, 0);
});
