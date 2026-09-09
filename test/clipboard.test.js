import test from "node:test";
import assert from "node:assert/strict";
import { copyText } from "../src/clipboard.js";

function legacyClipboard(copied) {
  const state = { text:null, removed:false, restored:false };
  const field = { style:{}, setAttribute() {}, select() {}, setSelectionRange() {}, remove() { state.removed = true; } };
  return { state, document:{
    body:{ appendChild(element) { state.text = element.value; } },
    activeElement:{ focus() { state.restored = true; } },
    createElement() { return field; },
    execCommand(command) { assert.equal(command, "copy"); return copied; },
  } };
}

test("copies the exact map code through the async clipboard API", async () => {
  let received;
  await copyText("001234", { clipboard:{ async writeText(text) { received = text; } }, document:null });
  assert.equal(received, "001234");
});

test("supports selection copy when the clipboard API is unavailable", async () => {
  const fallback = legacyClipboard(true);
  await copyText("987654", { clipboard:null, document:fallback.document });
  assert.deepEqual(fallback.state, { text:"987654", removed:true, restored:true });
});

test("recovers from a rejected async write using selection copy", async () => {
  const fallback = legacyClipboard(true);
  await copyText("123456", { clipboard:{ async writeText() { throw new Error("Denied"); } }, document:fallback.document });
  assert.deepEqual(fallback.state, { text:"123456", removed:true, restored:true });
});

test("reports failed copy and restores focus when both routes fail", async () => {
  const fallback = legacyClipboard(false);
  await assert.rejects(copyText("123456", { clipboard:{ async writeText() { throw new Error("Denied"); } }, document:fallback.document }), /Copy rejected/);
  assert.equal(fallback.state.removed, true);
  assert.equal(fallback.state.restored, true);
});

test("does not report success without clipboard access or a map code", async () => {
  await assert.rejects(copyText("123456", { clipboard:null, document:null }), /Copy unavailable/);
  await assert.rejects(copyText("", { clipboard:null, document:null }), /No map code/);
});
