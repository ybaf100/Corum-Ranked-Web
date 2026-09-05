import { afterEach, test, mock } from "node:test";
import assert from "node:assert/strict";
import { fetchText, loadRankedMaps, normalizeLeaderboard, normalizePlacement, parseRankedMaps, placementDisplay } from "../src/ranked-data.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; mock.timers.reset(); });
const csv = '\uFEFF순위,      맵 제목,Rating,대체 맵 코드,Ranked Pool (1~6),Qualifying %\r\n1,"Map, One",0,123,1,0\r\n2,Unassigned,5,456,,\r\n';
const progress = { state: "MAP_PLAYING", totalStages: 3, currentStageIndex: 2, currentMapIndex: 1, completedStages: 1, completedMaps: 2 };

test("parses published sheet2 headers, quoted titles, zero values and unassigned pools", () => {
  const maps = parseRankedMaps(csv);
  assert.deepEqual(maps[0], { title: "Map, One", difficulty: "0", mapCode: "123", pool: 1, qualifyingPercent: "0" });
  assert.equal(maps[1].pool, null);
  assert.throws(() => parseRankedMaps('<html>Sign in</html>'));
});

test("uses authoritative solo progress and preserves server order while Ranked is closed", () => {
  const payload = { serverOpen: false, players: [{ player: "third", tier: "UNRANKED", visibleRankedScore: null, placement: progress, placementGamesRequired: 5, placementResults: ["WIN", "LOSS"], hiddenMmr: 999 }, { player: "first", tier: "RED", visibleRankedScore: 150 }] };
  const result = normalizeLeaderboard(payload);
  assert.equal(result.serverOpen, false);
  assert.deepEqual(result.players.map((p) => p.player), ["third", "first"]);
  assert.equal(placementDisplay(result.players[0].placement).title, "Stage 2 / 3");
  assert.equal(placementDisplay(result.players[0].placement).progress, "완료 2 / 6 Maps");
  assert.doesNotMatch(JSON.stringify(result), /hiddenMmr|placementResults|placementGames/);
});

test("shows saved five-stage results without marking the next Stage as started", () => {
  const state = normalizePlacement({ ...progress, state: "STAGE_RESULT", totalStages: 5, currentMapIndex: 2, completedStages: 2, completedMaps: 4 });
  assert.equal(placementDisplay(state).title, "Stage 2 / 5");
  assert.equal(placementDisplay(state).detail, "다음 Stage 대기");
  assert.equal(placementDisplay(state).progress, "완료 4 / 10 Maps");
});

test("does not invent five-stage progress for legacy or malformed responses", () => {
  const result = normalizeLeaderboard({ players: [{ player: "old", tier: "UNRANKED", visibleRankedScore: null, placementGamesRequired: 5, placementResults: [] }] });
  assert.equal(placementDisplay(result.players[0].placement).title, "배치 미완료");
  assert.equal(normalizePlacement({ ...progress, totalStages: 4 }), null);
  assert.equal(normalizePlacement({ ...progress, completedMaps: 99 }), null);
  assert.equal(placementDisplay(normalizePlacement({ state: "NOT_STARTED" })).title, "배치 시작 전");
});

test("keeps promotion marks for Ranked players", () => {
  const result = normalizeLeaderboard({ players: [{ player: "ranked", tier: "AQUA", visibleRankedScore: 599, promotion: { sourceTier: "AQUA", targetTier: "BRONZE", gamesRequired: 3, winsRequired: 2, results: ["WIN", "DRAW", "LOSS"] } }] });
  assert.deepEqual(result.players[0].promotion.results, ["WIN", "LOSS"]);
  assert.equal(result.players[0].visibleRankedScore, 599);
});

test("loads public snapshot maps without requiring Google or an open queue", async () => {
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return Response.json({ serverOpen: false, maps: [{ title: "Map", difficulty: "0", mapCode: "123", pool: 1, qualifyingPercent: 0 }] }); };
  const result = await loadRankedMaps("https://ranked.example/maps", "https://sheets.example/csv", new AbortController().signal);
  assert.equal(result[0].qualifyingPercent, "0");
  assert.deepEqual(calls, ["https://ranked.example/maps"]);
});

test("falls back to stable CSV URL for older/offline or malformed map APIs", async () => {
  for (const response of [new Response("Not found", { status: 404 }), new Response("Offline", { status: 503 }), Response.json({ maps: "invalid" })]) {
    const calls = [];
    globalThis.fetch = async (url) => { calls.push(url); return calls.length === 1 ? response : new Response(csv); };
    const result = await loadRankedMaps("https://ranked.example/maps", "https://sheets.example/csv?gid=1", new AbortController().signal);
    assert.equal(result.length, 2);
    assert.deepEqual(calls, ["https://ranked.example/maps", "https://sheets.example/csv?gid=1"]);
  }
});

test("accepts a 30-second Sheet response instead of aborting at 15 seconds", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  let requestSignal;
  globalThis.fetch = (_url, { signal }) => new Promise((resolve, reject) => {
    requestSignal = signal;
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    setTimeout(() => resolve(new Response(csv)), 30_000);
  });
  const pending = fetchText("https://sheets.example/csv", new AbortController().signal);
  mock.timers.tick(15_001);
  assert.equal(requestSignal.aborted, false);
  mock.timers.tick(14_999);
  assert.deepEqual(parseRankedMaps(await pending), parseRankedMaps(csv));
});

test("aborts superseded requests without starting the Sheet fallback", async () => {
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = (_url, { signal }) => { calls++; return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })); };
  const pending = loadRankedMaps("https://ranked.example/maps", "https://sheets.example/csv", controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(calls, 1);
});

test("reports unavailable data when both sources fail", async () => {
  globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
  await assert.rejects(loadRankedMaps("https://ranked.example/maps", "https://sheets.example/csv", new AbortController().signal), /맵 목록을 불러오지 못했습니다/);
});
