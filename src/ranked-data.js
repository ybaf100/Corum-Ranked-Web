const TIER_ORDER = ["UNRANKED", "RED", "AQUA", "BRONZE", "SILVER", "GOLD"];

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
export function normalizeLeaderboard(payload) {
  const players = (Array.isArray(payload?.players) ? payload.players : []).flatMap((value) => {
    const player = String(value?.player || "").trim(); const tier = String(value?.tier || "UNRANKED").toUpperCase(); if (!player || !TIER_ORDER.includes(tier)) return [];
    const promotion = value.promotion && typeof value.promotion === "object" ? { sourceTier: String(value.promotion.sourceTier || tier).toUpperCase(), targetTier: String(value.promotion.targetTier || "").toUpperCase(), gamesRequired: Math.max(0, Number(value.promotion.gamesRequired) || 0), winsRequired: Math.max(0, Number(value.promotion.winsRequired) || 0), results: normalizeMarks(value.promotion.results) } : null;
    return [{ player, tier, visibleRankedScore: value.visibleRankedScore == null ? null : Number(value.visibleRankedScore), placement: normalizePlacement(value.placement), promotion, demotionWarning: Boolean(value.demotionWarning), wins: Math.max(0, Number(value.wins) || 0), losses: Math.max(0, Number(value.losses) || 0) }];
  });
  return { players, serverOpen: payload?.serverOpen === true };
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
