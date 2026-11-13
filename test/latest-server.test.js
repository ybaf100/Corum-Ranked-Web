import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RULES, bandForScore, baseTier, loadTierGuide, normalizeLeaderboard, normalizeRankedConfig, normalizeTierGuide, parseTierCsv, tierLabel } from "../src/ranked-data.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

// Shape of the live GET /api/ranked/leaderboard/tiers response (v0.6.0-beta.57).
const band = (tier, min, max, pool, extra = {}) => ({ tier, minInclusive: min, maxExclusive: max, mainPool: pool, deathmatchPool: Math.min(6, pool + 1), promotionGames: 0, promotionWinsRequired: 0, matchFormat: pool <= 3 ? "SINGLE" : "BO3", mapBan: true, ...extra });
const liveGuide = { mode: "SOLO_RANKED", tiers: [
  band("RED3", 0, 100, 2), band("RED2", 100, 200, 2), band("RED1", 200, 300, 2, { promotionGames: 3, promotionWinsRequired: 1 }),
  band("AQUA3", 300, 400, 3), band("AQUA2", 400, 500, 3), band("AQUA1", 500, 600, 3, { promotionGames: 3, promotionWinsRequired: 2 }),
  band("BRONZE3", 600, 700, 4), band("BRONZE2", 700, 800, 4), band("BRONZE1", 800, 900, 4, { promotionGames: 5, promotionWinsRequired: 3 }),
  band("SILVER3", 900, 1000, 5), band("SILVER2", 1000, 1100, 5), band("SILVER1", 1100, 1200, 5, { promotionGames: 5, promotionWinsRequired: 3 }),
  band("GOLD", 1200, null, 6, { deathmatchPool: 6 }),
], gold: { total: 8, championSlots: 3, masterSlots: 1, goldSlots: 4, championCutoffLp: 1500, masterCutoffLp: 1320 } };

test("labels Solo divisions and maps GOLD titles to the GOLD artwork", () => {
  assert.equal(tierLabel("RED3"), "RED III");
  assert.equal(tierLabel("SILVER1"), "SILVER I");
  assert.equal(tierLabel("CHAMPION"), "CHAMPION");
  assert.equal(baseTier("AQUA2"), "AQUA");
  assert.equal(baseTier("MASTER"), "GOLD");
  assert.equal(baseTier("UNRANKED"), "UNRANKED");
  assert.equal(baseTier("PLATINUM"), null);
});

test("keeps division and title tiers, server ranks, bots and equipped titles", () => {
  const result = normalizeLeaderboard({ serverOpen: true, totalPlayers: 4, players: [
    { gdAccountId: "1", player: "champ", tier: "CHAMPION", rank: 1, topPercent: 25, visibleRankedScore: 1600, wins: 9, losses: 1, equippedTitle: { nameKo: "[Solo] 연승", displayLabel: "III" } },
    { gdAccountId: "2", player: "bot", isBot: true, tier: "MASTER", rank: 2, visibleRankedScore: 1400 },
    { gdAccountId: "3", player: "climber", tier: "AQUA1", rank: 3, visibleRankedScore: 599, promotion: { sourceTier: "AQUA1", targetTier: "BRONZE3", gamesRequired: 3, winsRequired: 2, results: ["WIN"] } },
    { gdAccountId: "4", player: "unknown", tier: "DIAMOND", visibleRankedScore: 10 },
  ] });
  assert.deepEqual(result.players.map((p) => [p.player, p.tier, p.baseTier, p.rank]), [["champ", "CHAMPION", "GOLD", 1], ["bot", "MASTER", "GOLD", 2], ["climber", "AQUA1", "AQUA", 3]]);
  assert.equal(result.players[0].title, "[Solo] 연승 III");
  assert.equal(result.players[1].isBot, true);
  assert.equal(result.players[2].promotion.targetTier, "BRONZE3");
  assert.equal(result.totalPlayers, 4);
});

test("reads the Survival ladder without Solo placement fields", () => {
  const result = normalizeLeaderboard({ mode: "SURVIVAL", serverOpen: true, total: 120, hasMore: true, players: [
    { gdAccountId: "9", player: "runner", tier: "SILVER", tierId: "SILVER", rank: 1, visibleRankedScore: 980, wins: 4, losses: 6, winStreak: 2, placement: { state: "NOT_STARTED" } },
  ] });
  assert.equal(result.mode, "SURVIVAL");
  assert.equal(result.hasMore, true);
  assert.equal(result.totalPlayers, 120);
  assert.equal(result.players[0].placement, null);
  assert.equal(result.players[0].winStreak, 2);
});

test("normalizes the live tier guide, including formats, bans and protection floors", () => {
  const guide = normalizeTierGuide(liveGuide);
  assert.equal(guide.source, "api");
  assert.equal(guide.tiers.length, 13);
  assert.deepEqual(guide.tiers.filter((t) => t.demotionProtection).map((t) => t.tier), ["RED3", "AQUA3", "BRONZE3", "SILVER3", "GOLD"]);
  assert.equal(guide.tiers[0].matchFormat, "SINGLE");
  assert.equal(guide.tiers.at(-1).maximum, null);
  assert.equal(guide.gold.masterCutoffLp, 1320);
  assert.equal(bandForScore(guide.tiers, 150).label, "RED II");
  assert.equal(bandForScore(guide.tiers, 600 - 16).label, "AQUA I");
  assert.throws(() => normalizeTierGuide({ tiers: [band("RED3", 0, 100, 9)] }));
});

const header = "Tier,최소 점수(포함),최대 점수(미포함),Main Pool,Deathmatch Pool,Promotion Games,Promotion Wins Required,Match Format,Map Ban";
test("parses the 13-row division sheet with Match Format and Map Ban columns", () => {
  const rows = liveGuide.tiers.map((t) => [t.tier, t.minInclusive, t.maxExclusive ?? "", t.mainPool, t.deathmatchPool, t.promotionGames, t.promotionWinsRequired, t.matchFormat === "SINGLE" ? "단판" : "BO3", "TRUE"].join(","));
  const guide = parseTierCsv([header, ...rows].join("\n"));
  assert.equal(guide.source, "sheet");
  assert.deepEqual(guide.tiers.map((t) => t.tier), liveGuide.tiers.map((t) => t.tier));
  assert.equal(guide.tiers[2].promotionGames, 3);
  assert.equal(guide.tiers[0].matchFormat, "SINGLE");
  assert.equal(guide.tiers[6].matchFormat, "BO3");
});

test("splits a legacy five-row sheet into thirds exactly like the server", () => {
  const legacy = ["Tier,최소 점수(포함),최대 점수(미포함),Main Pool,Deathmatch Pool,Promotion Games,Promotion Wins Required",
    "RED,0,300,2,3,3,1", "AQUA,300,600,3,4,3,2", "BRONZE,600,900,4,5,5,3", "SILVER,900,1200,5,6,5,3", "GOLD,1200,,6,6,0,0"].join("\n");
  const guide = parseTierCsv(legacy);
  assert.equal(guide.tiers.length, 13);
  assert.deepEqual(guide.tiers.slice(0, 3).map((t) => [t.tier, t.minimum, t.maximum, t.promotionGames]), [["RED3", 0, 100, 0], ["RED2", 100, 200, 0], ["RED1", 200, 300, 3]]);
  assert.equal(guide.tiers[0].matchFormat, "BO3");
});

test("falls back from the tier API (e.g. blocked by CORS) to the published sheet", async () => {
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); if (calls.length === 1) throw new TypeError("Failed to fetch"); return new Response([header, "RED3,0,100,2,3,0,0,단판,TRUE", "GOLD,100,,6,6,0,0,BO3,FALSE"].join("\n")); };
  const guide = await loadTierGuide("https://api.example/tiers", "https://sheets.example/csv", new AbortController().signal);
  assert.equal(guide.source, "sheet");
  assert.equal(guide.tiers[1].mapBan, false);
  assert.deepEqual(calls, ["https://api.example/tiers", "https://sheets.example/csv"]);
});

test("reads rule clocks, mode switches and seasons from the public config", () => {
  const config = normalizeRankedConfig({ rulesVersion: "corum-ranked-v0.5", queueEnabled: true,
    rules: { roundSeconds: 300, clearTarget: 3, finalAttemptWindowSeconds: 10, lastAttemptWindowSeconds: 10, banSeconds: 10, bestOf: 3 },
    modes: { soloRanked: { ready: true, enabled: true }, survival: { ready: true, enabled: true, matchPlayerCount: 64 } },
    seasons: { SOLO_RANKED: { preseason: true, number: 0, targetAt: null }, SURVIVAL: { preseason: false, number: 2, targetAt: "2026-12-01T00:00:00Z" } } });
  assert.deepEqual(config.rules, DEFAULT_RULES);
  assert.equal(config.modes.survival.playerCount, 64);
  assert.equal(config.seasons.survival.number, 2);
  assert.equal(config.seasons.solo.preseason, true);
  const partial = normalizeRankedConfig({ rules: { roundSeconds: -1, clearTarget: 2 } });
  assert.equal(partial.rules.roundSeconds, 300);
  assert.equal(partial.rules.clearTarget, 2);
  assert.equal(partial.modes.survival.enabled, false);
  assert.throws(() => normalizeRankedConfig({}));
});

test("reads the public LIVE board and drops malformed matches", async () => {
  const { normalizeLive } = await import("../src/ranked-data.js");
  const board = normalizeLive({ solo: { queued: 2, matches: [
    { state: "ROUND_PLAYING", botMatch: false, effectiveTier: "BRONZE", format: "SINGLE", round: 1, roundWins: [0, 0],
      players: [{ name: "A", tier: "BRONZE2" }, { name: "B", isBot: true, tier: "BRONZE3" }], map: { title: "Map", difficulty: "20", pool: 4 },
      roundScore: { scores: [312.5, 0], clears: [1, 0] }, deadlineAt: "2026-11-13T09:00:00Z" },
    { state: "ROUND_PLAYING", players: [{ name: "only one" }] },
  ] }, survival: { queued: 0, matches: [{ state: "PLAYING", kind: "ONLINE", phase: "ROUND_2", targetQualifiers: 6, entrants: 16, alive: 10, humans: 3, aliveHumans: ["X"], map: { title: "Sky" } }] } });
  assert.equal(board.solo.queued, 2);
  assert.equal(board.solo.matches.length, 1);
  assert.equal(board.solo.matches[0].format, "SINGLE");
  assert.equal(board.solo.matches[0].map.difficulty, "20.0");
  assert.equal(board.solo.matches[0].players[1].isBot, true);
  assert.equal(board.survival.matches[0].alive, 10);
  assert.throws(() => normalizeLive({ solo: {} }));
});

test("formats season countdowns by remaining size and mode state", async () => {
  const { formatRemaining, seasonCountdown, sameSeason } = await import("../src/ranked-data.js");
  const H = 3_600_000, D = 24 * H;
  assert.equal(formatRemaining(3 * D + 5 * H + 59 * 60_000), "3일 5시간");
  assert.equal(formatRemaining(D - 1), "23시간 59분");
  assert.equal(formatRemaining(H + 61_000), "1시간 1분");
  assert.equal(formatRemaining(59 * 60_000 + 7_400), "59분 7초");
  assert.equal(formatRemaining(-5), "0분 0초");
  const now = Date.parse("2026-11-13T00:00:00Z");
  const season = { preseason: false, number: 2, targetAt: "2026-11-15T03:00:00.000Z" };
  assert.equal(seasonCountdown(season, true, now).text, "시즌 2 2일 3시간 남음");
  assert.equal(seasonCountdown(season, false, now).text, "시즌 2 2일 3시간 후 시작");
  assert.equal(seasonCountdown({ ...season, targetAt: null, preseason: true }, true, now).text, "프리시즌");
  assert.equal(seasonCountdown(season, true, Date.parse("2026-11-16T00:00:00Z")).time, "곧 종료");
  const config = { modes: { solo: { enabled: true }, survival: { enabled: true } }, seasons: { solo: season, survival: { ...season } } };
  assert.equal(sameSeason(config), true);
  assert.equal(sameSeason({ ...config, seasons: { solo: season, survival: { ...season, targetAt: "2026-11-16T00:00:00.000Z" } } }), false);
  assert.equal(sameSeason({ ...config, modes: { solo: { enabled: true }, survival: { enabled: false } } }), false);
});
