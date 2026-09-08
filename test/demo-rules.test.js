import { test } from "node:test";
import assert from "node:assert/strict";
import { SCORE_EXAMPLE, DEATHMATCH_EXAMPLE, STAGE_EXAMPLE, attemptExampleScore, stageExampleResult } from "../src/demo-rules.js";

test("score illustration respects Qualifying, flooring, band boundaries and Clear", () => {
  assert.deepEqual(SCORE_EXAMPLE.progress.map(p => attemptExampleScore(p, SCORE_EXAMPLE.qualifying)), [0, 0, 40, 75, 150, 250]);
  for (const [progress, qualifying, expected] of [[24.999,25,0],[25,25,25],[49.999,25,49],[50,25,75],[74.999,25,111],[75,25,150],[99.999,25,198],[100,25,250],[75,80,0]]) {
    assert.equal(attemptExampleScore(progress, qualifying), expected);
  }
});

test("Stage illustration uses both Map scores and current Grade/Pool rules", () => {
  assert.deepEqual(stageExampleResult(STAGE_EXAMPLE.mapScores, STAGE_EXAMPLE.pool), { score:350, grade:"A", mapGrades:["A","B"], nextPool:4 });
  assert.equal(stageExampleResult([425,500],3).nextPool,5);
  assert.equal(stageExampleResult([500,400],3).nextPool,4);
  assert.equal(stageExampleResult([250,250],3).nextPool,3);
  assert.equal(stageExampleResult([150,150],3).nextPool,2);
  assert.equal(stageExampleResult([0,100],3).nextPool,1);
  assert.equal(stageExampleResult([0,200],3).nextPool,2);
  assert.equal(stageExampleResult([500,500],6).nextPool,6);
  assert.equal(stageExampleResult([0,0],1).nextPool,1);
});

test("Death Match example contains exactly three raw progress records per player", () => {
  assert.ok(DEATHMATCH_EXAMPLE.every(player => player.attempts.length === 3));
  assert.ok(DEATHMATCH_EXAMPLE.every(player => player.attempts.every(p => p >= 0 && p <= 100)));
  assert.deepEqual(DEATHMATCH_EXAMPLE.map(player => Math.max(...player.attempts)), [91.2,86.8]);
});
