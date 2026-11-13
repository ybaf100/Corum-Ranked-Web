export const BASE_TIERS = ["RED", "AQUA", "BRONZE", "SILVER", "GOLD"];
// Solo uses numbered divisions (III → I) below GOLD, and GOLD titles computed on read.
export const SOLO_DIVISION_TIERS = ["RED3", "RED2", "RED1", "AQUA3", "AQUA2", "AQUA1", "BRONZE3", "BRONZE2", "BRONZE1", "SILVER3", "SILVER2", "SILVER1", "GOLD"];
const DISPLAY_TIERS = new Set(["UNRANKED", ...BASE_TIERS, ...SOLO_DIVISION_TIERS, "MASTER", "CHAMPION"]);

/** RED3 → RED, MASTER/CHAMPION → GOLD; anything unknown → null. */
export function baseTier(tier) {
  const value = String(tier ?? "").trim().toUpperCase();
  if (value === "UNRANKED") return "UNRANKED";
  if (value === "MASTER" || value === "CHAMPION") return "GOLD";
  const base = value.replace(/[123]$/, "");
  return BASE_TIERS.includes(base) ? base : null;
}
/** RED3 → "RED III" (the in-game Roman division label). */
export function tierLabel(tier) {
  return String(tier ?? "").toUpperCase().replace(/([123])$/, (_, digit) => ` ${digit === "3" ? "III" : digit === "2" ? "II" : "I"}`);
}

function normalizeDifficulty(value) {
  const difficulty = String(value ?? "").trim();
  return /^20(?:\.0+)?$/.test(difficulty) ? "20.0" : difficulty;
}

function normalizeHeader(value) { return String(value || "").replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim(); }
function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]; const next = text[i + 1];
    if (c === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i += 1;
      row.push(cell); if (row.some((v) => v.trim())) rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  row.push(cell); if (row.some((v) => v.trim())) rows.push(row); return rows;
}
export function csvObjects(text) {
  const rows = parseCsv(text); if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] || "").trim()])));
}
export function parseRankedMaps(csv) {
  const headers = (parseCsv(csv)[0] || []).map(normalizeHeader);
  if (!["맵 제목", "Rating", "대체 맵 코드", "Ranked Pool (1~6)", "Qualifying %"].every((name) => headers.includes(name))) throw new Error("공개 시트의 맵 목록 형식이 올바르지 않습니다.");
  return csvObjects(csv).flatMap((row) => {
    const title = row["맵 제목"]; const difficulty = normalizeDifficulty(row.Rating); const mapCode = row["대체 맵 코드"];
    const poolValue = Number(row["Ranked Pool (1~6)"]); const pool = Number.isInteger(poolValue) && poolValue >= 1 && poolValue <= 6 ? poolValue : null;
    const qualifyingPercent = String(row["Qualifying %"] || "").replace(/%$/, "");
    return title && difficulty && mapCode ? [{ title, difficulty, mapCode, pool, qualifyingPercent }] : [];
  });
}
function normalizeMarks(value) { return Array.isArray(value) ? value.filter((mark) => mark === "WIN" || mark === "LOSS") : []; }
function normalizeTitle(value) {
  if (!value || typeof value !== "object") return null;
  const name = String(value.nameKo || "").trim();
  if (!name) return null;
  const label = value.displayLabel == null ? "" : String(value.displayLabel).trim();
  return label ? `${name} ${label}` : name;
}
function finiteOrNull(value) { const number = Number(value); return value == null || !Number.isFinite(number) ? null : number; }

/** Public Solo or Survival ladder. Server order and server rank are authoritative. */
export function normalizeLeaderboard(payload) {
  const survival = payload?.mode === "SURVIVAL";
  const players = (Array.isArray(payload?.players) ? payload.players : []).flatMap((value) => {
    const player = String(value?.player || "").trim(); const tier = String(value?.tier || "UNRANKED").toUpperCase(); if (!player || !DISPLAY_TIERS.has(tier)) return [];
    const promotion = value.promotion && typeof value.promotion === "object" && value.promotion.targetTier ? { sourceTier: String(value.promotion.sourceTier || tier).toUpperCase(), targetTier: String(value.promotion.targetTier || "").toUpperCase(), gamesRequired: Math.max(0, Number(value.promotion.gamesRequired) || 0), winsRequired: Math.max(0, Number(value.promotion.winsRequired) || 0), results: normalizeMarks(value.promotion.results) } : null;
    const rank = finiteOrNull(value.rank);
    return [{
      id: String(value.gdAccountId || player), player, tier, baseTier: baseTier(tier),
      isBot: value.isBot === true, title: normalizeTitle(value.equippedTitle),
      rank: rank !== null && rank >= 1 ? Math.floor(rank) : null, topPercent: finiteOrNull(value.topPercent),
      visibleRankedScore: value.visibleRankedScore == null ? null : Number(value.visibleRankedScore),
      placement: survival ? null : normalizePlacement(value.placement), promotion, demotionWarning: Boolean(value.demotionWarning),
      wins: Math.max(0, Number(value.wins) || 0), losses: Math.max(0, Number(value.losses) || 0),
      winStreak: survival ? Math.max(0, Number(value.winStreak) || 0) : null,
    }];
  });
  const total = Number(payload?.totalPlayers ?? payload?.total);
  return { mode: survival ? "SURVIVAL" : "SOLO_RANKED", players, serverOpen: payload?.serverOpen === true, totalPlayers: Number.isFinite(total) ? total : players.length, hasMore: payload?.hasMore === true };
}

export const DEFAULT_RULES = Object.freeze({ roundSeconds: 300, clearTarget: 3, finalAttemptWindowSeconds: 10, lastAttemptWindowSeconds: 10, banSeconds: 10 });
const positiveInteger = (value, fallback) => Number.isSafeInteger(value) && value > 0 ? value : fallback;
function normalizeSeason(value) {
  if (!value || typeof value !== "object") return { preseason: true, number: 0, targetAt: null };
  const at = value.targetAt ? new Date(value.targetAt) : null;
  return { preseason: value.preseason !== false, number: Math.max(0, Number(value.number) || 0), targetAt: at && !Number.isNaN(at.getTime()) ? at.toISOString() : null };
}
/** Public /api/ranked/config: only the rule clock, mode switches and seasons are used. */
export function normalizeRankedConfig(payload) {
  if (!payload || typeof payload !== "object" || !payload.rules || typeof payload.rules !== "object") throw new Error("Ranked 설정 응답 형식이 올바르지 않습니다.");
  const rules = Object.fromEntries(Object.entries(DEFAULT_RULES).map(([key, fallback]) => [key, positiveInteger(payload.rules[key], fallback)]));
  const solo = payload.modes?.soloRanked; const survival = payload.modes?.survival;
  return {
    rulesVersion: String(payload.rulesVersion || payload.rules.rulesVersion || ""),
    rules,
    modes: {
      solo: { enabled: (solo ? solo.enabled : payload.queueEnabled) === true },
      survival: { enabled: survival?.enabled === true && survival?.ready !== false, playerCount: [16, 64].includes(survival?.matchPlayerCount) ? survival.matchPlayerCount : null },
    },
    seasons: { solo: normalizeSeason(payload.seasons?.SOLO_RANKED), survival: normalizeSeason(payload.seasons?.SURVIVAL) },
  };
}

function boolText(value, fallback) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toUpperCase();
  return text === "TRUE" ? true : text === "FALSE" ? false : fallback;
}
function formatText(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return text === "SINGLE" || text === "BO1" || text === "단판" ? "SINGLE" : "BO3";
}
function finishTierBand(band) {
  const tier = String(band.tier).toUpperCase();
  return {
    tier, label: tierLabel(tier), baseTier: baseTier(tier),
    minimum: band.minimum, maximum: band.maximum,
    mainPool: band.mainPool, deathmatchPool: band.deathmatchPool,
    promotionGames: band.promotionGames, promotionWinsRequired: band.promotionWinsRequired,
    matchFormat: formatText(band.matchFormat), mapBan: boolText(band.mapBan, true),
    // Grade III (and an undivided tier) is the base-tier floor with demotion protection.
    demotionProtection: !/[12]$/.test(tier),
  };
}
const validPool = (value) => Number.isInteger(value) && value >= 1 && value <= 6;
function validBands(bands) {
  if (!bands.length) throw new Error("티어 구간 정보가 비어 있습니다.");
  for (const band of bands) {
    if (!SOLO_DIVISION_TIERS.includes(band.tier) && !BASE_TIERS.includes(band.tier)) throw new Error("티어 구간 형식이 올바르지 않습니다.");
    if (!Number.isFinite(band.minimum) || (band.maximum !== null && !(band.maximum > band.minimum)) || !validPool(band.mainPool) || !validPool(band.deathmatchPool)) throw new Error("티어 구간 형식이 올바르지 않습니다.");
  }
  return bands.sort((a, b) => a.minimum - b.minimum);
}
/** Same rule as the server: a legacy five-row sheet is split into III/II/I thirds. */
function expandLegacyBands(bands) {
  if (bands.length !== 5 || !BASE_TIERS.every((tier) => bands.some((band) => band.tier === tier))) return bands;
  return BASE_TIERS.flatMap((tier) => {
    const band = bands.find((item) => item.tier === tier);
    if (tier === "GOLD" || band.maximum === null) return [band];
    const span = band.maximum - band.minimum;
    const cuts = [band.minimum, Math.ceil(band.minimum + span / 3), Math.ceil(band.minimum + 2 * span / 3), band.maximum];
    return [3, 2, 1].map((division, index) => finishTierBand({ ...band, tier: `${tier}${division}`, minimum: cuts[index], maximum: cuts[index + 1],
      promotionGames: division === 1 ? band.promotionGames : 0, promotionWinsRequired: division === 1 ? band.promotionWinsRequired : 0 }));
  });
}
function normalizeGold(value) {
  const count = (key) => Math.max(0, Number(value?.[key]) || 0);
  return value && typeof value === "object" ? {
    total: count("total"), championSlots: count("championSlots"), masterSlots: count("masterSlots"), goldSlots: count("goldSlots"),
    championCutoffLp: finiteOrNull(value.championCutoffLp), masterCutoffLp: finiteOrNull(value.masterCutoffLp),
  } : null;
}
/** Live Solo tier guide (GET /api/ranked/leaderboard/tiers). */
export function normalizeTierGuide(payload) {
  if (!Array.isArray(payload?.tiers)) throw new Error("티어 가이드 응답 형식이 올바르지 않습니다.");
  const bands = payload.tiers.map((band) => finishTierBand({
    tier: band?.tier, minimum: Number(band?.minInclusive), maximum: band?.maxExclusive == null ? null : Number(band.maxExclusive),
    mainPool: Number(band?.mainPool), deathmatchPool: Number(band?.deathmatchPool),
    promotionGames: Math.max(0, Number(band?.promotionGames) || 0), promotionWinsRequired: Math.max(0, Number(band?.promotionWinsRequired) || 0),
    matchFormat: band?.matchFormat, mapBan: band?.mapBan,
  }));
  return { source: "api", tiers: validBands(bands), gold: normalizeGold(payload.gold) };
}
/** Published "Ranked Tiers" sheet. Accepts the 13-row division layout and the legacy 5-row layout. */
export function parseTierCsv(csv) {
  const bands = csvObjects(csv).flatMap((row) => {
    const tier = String(row.Tier || "").trim().toUpperCase(); const minimum = Number(row["최소 점수(포함)"]); const maximumText = String(row["최대 점수(미포함)"] ?? "").trim();
    if (!tier || tier === "UNRANKED" || !Number.isFinite(minimum) || row["최소 점수(포함)"] === "") return [];
    return [finishTierBand({ tier, minimum, maximum: maximumText === "" ? null : Number(maximumText),
      mainPool: Number(row["Main Pool"]), deathmatchPool: Number(row["Deathmatch Pool"]),
      promotionGames: Math.max(0, Number(row["Promotion Games"]) || 0), promotionWinsRequired: Math.max(0, Number(row["Promotion Wins Required"]) || 0),
      matchFormat: row["Match Format"], mapBan: row["Map Ban"] })];
  });
  return { source: "sheet", tiers: validBands(expandLegacyBands(validBands(bands))), gold: null };
}
export function bandForScore(tiers, score) {
  return tiers.find((band) => score >= band.minimum && (band.maximum === null || score < band.maximum)) || null;
}

const PLACEMENT_STATES = new Set(["POOL_SELECTION", "MAP_PREPARE", "MAP_PLAYING", "MAP_SETTLING", "MAP_RESULT", "STAGE_RESULT", "PLACEMENT_RESULT"]);

export function normalizePlacement(value) {
  if (!value || typeof value !== "object") return null;
  if (value.state === "NOT_STARTED" || value.state === "CANCELLED") return { state: value.state };
  const { state, totalStages, currentStageIndex, currentMapIndex, completedStages, completedMaps } = value;
  if (!PLACEMENT_STATES.has(state) || ![3, 5].includes(totalStages)) return null;
  if (!Number.isInteger(currentStageIndex) || currentStageIndex < 1 || currentStageIndex > totalStages || ![1, 2].includes(currentMapIndex)) return null;
  if (!Number.isInteger(completedStages) || completedStages < 0 || completedStages > totalStages) return null;
  if (!Number.isInteger(completedMaps) || completedMaps < 0 || completedMaps > totalStages * 2) return null;
  return { state, totalStages, currentStageIndex, currentMapIndex, completedStages, completedMaps };
}

export function placementDisplay(placement) {
  if (!placement) return { title: "배치 미완료", detail: "상세 진행 정보 없음", progress: "—" };
  if (placement.state === "NOT_STARTED") return { title: "배치 시작 전", detail: "3 Stage / 5 Stage 선택 대기", progress: "시작 전" };
  if (placement.state === "CANCELLED") return { title: "배치 중단", detail: "새 배치 시작 필요", progress: "중단됨" };
  const labels = { POOL_SELECTION: "시작 준비", MAP_PREPARE: "맵 준비 중", MAP_PLAYING: "플레이 중", MAP_SETTLING: "마지막 Attempt 진행 중", MAP_RESULT: "맵 완료", STAGE_RESULT: placement.currentStageIndex === placement.totalStages ? "최종 배치 결과 대기" : "다음 Stage 대기", PLACEMENT_RESULT: "배치 완료" };
  const mapLabel = placement.state.startsWith("MAP_") ? `Map ${placement.currentMapIndex} / 2 · ` : "";
  return {
    ...placement,
    title: `Stage ${placement.currentStageIndex} / ${placement.totalStages}`,
    detail: `${mapLabel}${labels[placement.state]}`,
    progress: `완료 ${placement.completedMaps} / ${placement.totalStages * 2} Maps`,
  };
}

async function fetchData(url, signal, format, timeoutMs) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new DOMException("응답 대기 시간이 초과되었습니다.", "TimeoutError")), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-cache", credentials: "omit", signal: controller.signal });
    if (!response.ok) throw new Error(`요청 실패 (${response.status})`);
    return await response[format]();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

// Published Sheets CSV may take around 30 seconds across its redirects.
// Keep its stable URL so every page visit does not create a new cache key.
export async function fetchText(url, signal) {
  const text = await fetchData(url, signal, "text", 45_000);
  if (/^\s*(?:<!doctype\s+html|<html)/i.test(text)) throw new Error("공개 시트에서 CSV 데이터를 받지 못했습니다.");
  return text;
}

export function normalizePublicMaps(payload) {
  if (!Array.isArray(payload?.maps)) throw new Error("맵 목록 응답 형식이 올바르지 않습니다.");
  return payload.maps.map((map) => {
    const title = String(map?.title || "").trim();
    const difficulty = normalizeDifficulty(map?.difficulty);
    const mapCode = String(map?.mapCode || "").trim();
    const pool = map?.pool;
    const qualifying = map?.qualifyingPercent;
    if (!title || !difficulty || !mapCode || !Number.isInteger(pool) || pool < 1 || pool > 6 || !Number.isFinite(qualifying) || qualifying < 0 || qualifying > 100) throw new Error("맵 목록 응답 형식이 올바르지 않습니다.");
    return { title, difficulty, mapCode, pool, qualifyingPercent: String(qualifying) };
  });
}

export function fetchJson(url, signal, timeoutMs = 15_000) {
  return fetchData(url, signal, "json", timeoutMs);
}

export async function loadTierGuide(apiUrl, sheetUrl, signal) {
  try {
    return normalizeTierGuide(await fetchJson(apiUrl, signal));
  } catch (error) {
    if (signal?.aborted) throw error;
    // The live guide needs the API (and its CORS origin). The published sheet is the fallback.
    try {
      return parseTierCsv(await fetchText(sheetUrl, signal));
    } catch (sheetError) {
      if (signal?.aborted) throw sheetError;
      throw new Error("서버와 공개 시트에서 티어 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }
}

export async function loadRankedMaps(apiUrl, sheetUrl, signal) {
  try {
    return normalizePublicMaps(await fetchData(apiUrl, signal, "json", 15_000));
  } catch (error) {
    if (signal?.aborted) throw error;
    // The public snapshot route is also allowed while matchmaking is closed.
    // Older/offline servers fall back to the original public sheet2 CSV.
    try {
      return parseRankedMaps(await fetchText(sheetUrl, signal));
    } catch (sheetError) {
      if (signal?.aborted) throw sheetError;
      throw new Error("서버와 공개 시트에서 맵 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }
}
