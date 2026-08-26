import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const SHEET_BASE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRzHKOAa1pnP8TCB3d22TZwM5G3BgQSZhiFloApWA6mMptX6PdU_q6bKj8fs9IhpujO9WZ8Cln7e6vW/pub";
const SHEET2_CSV_URL = `${SHEET_BASE}?gid=1963044442&single=true&output=csv`;
const TIER_CSV_URL = `${SHEET_BASE}?gid=905346942&single=true&output=csv`;
const CONFIG_CSV_URL = `${SHEET_BASE}?gid=676041316&single=true&output=csv`;
const RANKED_API_URL = (import.meta.env.VITE_RANKED_API_URL || "https://corum-ranked.onrender.com").replace(/\/$/, "");
const LEADERBOARD_URL = `${RANKED_API_URL}/api/ranked/leaderboard`;
const THEME_STORAGE_KEY = "corum-ranked-theme";
const POOLS = [1, 2, 3, 4, 5, 6];
const TIER_ORDER = ["UNRANKED", "RED", "AQUA", "BRONZE", "SILVER", "GOLD"];

const DIFFICULTY_ORDER = [
  "0", "Tiny", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "18+", "19", "19+",
  "20.0", "20.1", "20.2", "20.3", "20.4", "20.5", "20.6", "20.7", "20.8",
  "20.9", "21", "21+",
];

const DIFFICULTY_COLORS = {
  0: "#e8eaed", Tiny: "#ff6fff", 1: "#0099ff", 2: "#00bbff",
  3: "#00ddff", 4: "#00ffff", 5: "#00ffaa", 6: "#00ff00",
  7: "#66ff00", 8: "#99ff00", 9: "#ccff00", 10: "#ffff00",
  11: "#ffdd00", 12: "#ffcc00", 13: "#ffaa00", 14: "#ff8800",
  15: "#ff6600", 16: "#ff4400", 17: "#ff0000", 18: "#cc0000",
  "18+": "#a61c00", 19: "#660000", "19+": "#460c00", "20.0": "#360900",
  20.1: "#240600", 20.2: "#130400", 20.3: "#000000", 20.4: "#0a031f",
  20.5: "#11072d", 20.6: "#180b3b", 20.7: "#180b3b", 20.8: "#261358",
  20.9: "#2d1766", 21: "#351c75", "21+": "#4511c9",
};

const TIER_POOL_DISTRIBUTION = [
  { tier: "RED", counts: [1, 3, 1, 0, 0, 0] },
  { tier: "AQUA", counts: [0, 1, 3, 1, 0, 0] },
  { tier: "BRONZE", counts: [0, 0, 1, 3, 1, 0] },
  { tier: "SILVER", counts: [0, 0, 0, 1, 3, 1] },
  { tier: "GOLD", counts: [0, 0, 0, 1, 2, 2] },
];

function Icon({ name }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "sun") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" {...common} /><path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" {...common} /></svg>;
  if (name === "moon") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.4A8 8 0 0 1 8.6 4a7.7 7.7 0 1 0 11.4 11.4Z" {...common} /></svg>;
  if (name === "download") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14" {...common} /></svg>;
  if (name === "refresh") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6" {...common} /></svg>;
  if (name === "info") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" {...common} /><path d="M12 11v6M12 7h.01" {...common} /></svg>;
  if (name === "rank") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4ZM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6" {...common} /></svg>;
  if (name === "list") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...common} /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" {...common} /><path d="m16 16 4 4" {...common} /></svg>;
}

function normalizeHeader(value) {
  return String(value || "").replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function csvObjects(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] || "").trim()])));
}

function parseRankedMaps(csv) {
  return csvObjects(csv).flatMap((row) => {
    const title = row["맵 제목"];
    const difficulty = row.Rating;
    const mapCode = row["대체 맵 코드"];
    const poolValue = Number(row["Ranked Pool (1~6)"]);
    const pool = Number.isInteger(poolValue) && poolValue >= 1 && poolValue <= 6 ? poolValue : null;
    const qualifyingPercent = String(row["Qualifying %"] || "").replace(/%$/, "");
    if (!title || !difficulty || !mapCode) return [];
    return [{ title, difficulty, mapCode, pool, qualifyingPercent }];
  });
}

function parseTierRules(csv) {
  return csvObjects(csv).flatMap((row) => {
    const tier = String(row.Tier || "").toUpperCase();
    const minimum = Number(row["최소 점수(포함)"]);
    const maximumText = row["최대 점수(미포함)"];
    if (!TIER_ORDER.includes(tier) || tier === "UNRANKED" || !Number.isFinite(minimum)) return [];
    return [{
      tier,
      minimum,
      maximum: maximumText === "" ? null : Number(maximumText),
      mainPool: Number(row["Main Pool"]),
      deathmatchPool: Number(row["Deathmatch Pool"]),
      promotionGames: Number(row["Promotion Games"]),
      promotionWinsRequired: Number(row["Promotion Wins Required"]),
    }];
  }).sort((left, right) => left.minimum - right.minimum);
}

function parseRankedConfig(csv) {
  const config = {};
  csvObjects(csv).forEach((row) => {
    const key = row.Key || row.key || Object.values(row)[0];
    const rawValue = row.Value ?? row.value ?? Object.values(row)[1];
    if (key) config[key] = rawValue !== "" && Number.isFinite(Number(rawValue)) ? Number(rawValue) : rawValue;
  });
  return config;
}

function normalizeMarks(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((mark) => mark === "WIN" || mark === "LOSS");
}

function normalizeLeaderboard(payload) {
  const source = Array.isArray(payload?.players) ? payload.players : [];
  return source.flatMap((value) => {
    const player = String(value?.player || "").trim();
    const tier = String(value?.tier || "UNRANKED").toUpperCase();
    if (!player || !TIER_ORDER.includes(tier)) return [];
    const promotion = value.promotion && typeof value.promotion === "object" ? {
      sourceTier: String(value.promotion.sourceTier || tier).toUpperCase(),
      targetTier: String(value.promotion.targetTier || "").toUpperCase(),
      gamesRequired: Math.max(0, Number(value.promotion.gamesRequired) || 0),
      winsRequired: Math.max(0, Number(value.promotion.winsRequired) || 0),
      results: normalizeMarks(value.promotion.results),
    } : null;
    return [{
      player,
      tier,
      visibleRankedScore: value.visibleRankedScore === null ? null : Number(value.visibleRankedScore),
      placementGames: Math.max(0, Number(value.placementGames) || 0),
      placementGamesRequired: Math.max(0, Number(value.placementGamesRequired) || 0),
      placementResults: normalizeMarks(value.placementResults),
      promotion,
      demotionWarning: Boolean(value.demotionWarning),
      wins: Math.max(0, Number(value.wins) || 0),
      draws: Math.max(0, Number(value.draws) || 0),
      losses: Math.max(0, Number(value.losses) || 0),
    }];
  });
}

function difficultyIndex(value) {
  return DIFFICULTY_ORDER.indexOf(/^20(?:\.0+)?$/.test(value) ? "20.0" : value);
}

function difficultyTextColor(value) {
  const hex = (DIFFICULTY_COLORS[value] || "#e8eaed").replace("#", "");
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 145 ? "#07080d" : "#ffffff";
}

function getInitialTheme() {
  const current = document.documentElement.dataset.theme;
  if (current === "light" || current === "dark") return current;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#07080d" : "#f4f4f1");
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (_) {}
  }, [theme]);
  return { theme, toggleTheme: () => setTheme((value) => value === "dark" ? "light" : "dark") };
}

function useRemoteData(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    loader(controller.signal)
      .then((data) => setState({ data, loading: false, error: "" }))
      .catch((reason) => {
        if (!controller.signal.aborted) setState({ data: null, loading: false, error: reason instanceof Error ? reason.message : "데이터를 불러오지 못했습니다." });
      });
    return () => controller.abort();
  }, [reloadKey]);
  return { ...state, reload: () => setReloadKey((value) => value + 1) };
}

async function fetchText(url, signal) {
  const requestSignal = typeof AbortSignal.any === "function" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
    : signal;
  const response = await fetch(`${url}&v=${Date.now()}`, { cache: "no-store", signal: requestSignal });
  if (!response.ok) throw new Error(`요청 실패 (${response.status})`);
  return response.text();
}

function useRankedMaps() {
  const remote = useRemoteData(async (signal) => parseRankedMaps(await fetchText(SHEET2_CSV_URL, signal)));
  return { ...remote, maps: remote.data || [] };
}

function useLeaderboard() {
  const remote = useRemoteData(async (signal) => {
    const requestSignal = typeof AbortSignal.any === "function" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
      : signal;
    const response = await fetch(`${LEADERBOARD_URL}?v=${Date.now()}`, { cache: "no-store", signal: requestSignal });
    if (!response.ok) throw new Error(`Ranked 서버 요청 실패 (${response.status})`);
    return normalizeLeaderboard(await response.json());
  });
  return { ...remote, players: remote.data || [] };
}

function useRankedInformation() {
  const remote = useRemoteData(async (signal) => {
    const [tierCsv, configCsv] = await Promise.all([fetchText(TIER_CSV_URL, signal), fetchText(CONFIG_CSV_URL, signal)]);
    return { tiers: parseTierRules(tierCsv), config: parseRankedConfig(configCsv) };
  });
  return { ...remote, tiers: remote.data?.tiers || [], config: remote.data?.config || {} };
}

function DifficultyBadge({ value }) {
  return <span className="difficulty-badge" style={{ background: DIFFICULTY_COLORS[value] || "#e8eaed", color: difficultyTextColor(value) }}>{value}</span>;
}

function TierBadge({ tier }) {
  return <span className={`tier-badge tier-${tier.toLowerCase()}`}>{tier}</span>;
}

function StateCard({ type, title, description, action }) {
  return <div className={`state-card ${type === "error" ? "error-state" : ""}`} role={type === "error" ? "alert" : undefined}>
    <span>{type === "error" ? "LOAD FAILED" : "NO DATA"}</span><h2>{title}</h2><p>{description}</p>{action}
  </div>;
}

function MapList({ maps, loading, error, reload }) {
  const [query, setQuery] = useState("");
  const [poolFilter, setPoolFilter] = useState("all");
  const assignedMaps = useMemo(() => maps.filter((map) => map.pool !== null), [maps]);
  const unassignedCount = maps.length - assignedMaps.length;
  const filteredMaps = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return assignedMaps.filter((map) => {
      const matchesQuery = !normalizedQuery || map.title.toLocaleLowerCase().includes(normalizedQuery) || map.mapCode.toLocaleLowerCase().includes(normalizedQuery);
      return matchesQuery && (poolFilter === "all" || map.pool === Number(poolFilter));
    }).sort((left, right) => left.pool - right.pool || difficultyIndex(right.difficulty) - difficultyIndex(left.difficulty) || left.title.localeCompare(right.title, "ko"));
  }, [assignedMaps, poolFilter, query]);

  return <section className="tab-page">
    <div className="page-heading"><div><p className="section-kicker">SHEET2 / LIVE MAP DATA</p><h1>Ranked Map Pool</h1><p>현재 Ranked에 배정된 맵과 경기 진입 기준을 확인합니다.</p></div><div className="total-counter"><span>ACTIVE MAPS</span><strong>{loading ? "—" : assignedMaps.length}</strong></div></div>
    <div className="list-toolbar"><label className="search-shell"><Icon name="search" /><span className="sr-only">맵 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="맵 제목 또는 맵 코드 검색" /></label><select className="pool-select" value={poolFilter} onChange={(event) => setPoolFilter(event.target.value)} aria-label="Ranked Pool 필터"><option value="all">전체 Pool</option>{POOLS.map((pool) => <option value={pool} key={pool}>Pool {pool}</option>)}</select><button className="reload-button" type="button" onClick={reload} disabled={loading}><Icon name="refresh" />새로고침</button></div>
    {error ? <StateCard type="error" title="sheet2를 불러오지 못했습니다." description={error} action={<button className="primary-button" onClick={reload}>다시 시도</button>} />
      : loading ? <div className="map-list" aria-busy="true">{Array.from({ length: 7 }, (_, index) => <div className="map-row skeleton-row" key={index}><i /><i /><i /><i /><i /></div>)}</div>
      : filteredMaps.length ? <><div className="result-line"><span>{filteredMaps.length} MAPS</span>{unassignedCount > 0 && <small>Pool 미배정 {unassignedCount}개는 목록에서 제외됨</small>}</div><div className="map-list"><div className="map-list-head" aria-hidden="true"><span>POOL</span><span>MAP</span><span>DIFFICULTY</span><span>MAP CODE</span><span>QUALIFYING</span></div>{filteredMaps.map((map) => <article className={`map-row pool-${map.pool}`} key={`${map.mapCode}-${map.title}`}><div className="pool-mark"><span>POOL</span><strong>{map.pool}</strong></div><div className="map-title"><h2>{map.title}</h2><span>RANKED MAP</span></div><DifficultyBadge value={map.difficulty} /><div className="map-code"><span>맵 코드</span><strong>{map.mapCode}</strong></div><div className="qualifying"><span>QUALIFYING</span><strong>{map.qualifyingPercent ? `${map.qualifyingPercent}%` : "—"}</strong></div></article>)}</div></>
      : <StateCard title={assignedMaps.length ? "검색 결과가 없습니다." : "배정된 맵이 없습니다."} description={assignedMaps.length ? "검색어나 Pool 필터를 변경해 보세요." : "sheet2의 Ranked Pool (1~6) 열에 Pool 값을 입력하면 여기에 표시됩니다."} />}
  </section>;
}

function formatMarks(results, required) {
  const marks = results.slice(0, required).map((result) => result === "WIN" ? "O" : "X");
  return `${marks.join("")}${"-".repeat(Math.max(0, required - marks.length))}`;
}

function formatWinRate(player) {
  const total = player.wins + player.draws + player.losses;
  if (!total) return "0";
  const rate = player.wins / total * 100;
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(1);
}

function PlayerStatus({ player }) {
  if (player.tier === "UNRANKED" || player.visibleRankedScore === null) return <div className="player-status"><TierBadge tier="UNRANKED" /><strong className="series-marks">{formatMarks(player.placementResults, player.placementGamesRequired)}</strong><small>배치 {player.placementGames}/{player.placementGamesRequired}</small></div>;
  if (player.promotion) return <div className="player-status"><TierBadge tier={player.promotion.sourceTier} /><strong className="series-marks">{formatMarks(player.promotion.results, player.promotion.gamesRequired)}</strong><small>{player.promotion.targetTier} 승급전 · {player.promotion.winsRequired}승 필요</small></div>;
  return <div className="player-status"><TierBadge tier={player.tier} /><strong className="lp-value">{Number.isFinite(player.visibleRankedScore) ? player.visibleRankedScore.toLocaleString() : "—"} LP</strong>{player.demotionWarning && <small className="warning-label">강등 경고</small>}</div>;
}

function Ranking({ players, loading, error, reload }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => players.filter((player) => player.player.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [players, query]);
  return <section className="tab-page">
    <div className="page-heading"><div><p className="section-kicker">RANKED DATABASE / PUBLIC DATA</p><h1>Leaderboard</h1><p>LP, 티어, 전적과 배치·승급전 상태만 표시합니다. 비공개 내부 점수는 사용하지 않습니다.</p></div><div className="total-counter"><span>PLAYERS</span><strong>{loading ? "—" : players.length}</strong></div></div>
    <div className="list-toolbar ranking-toolbar"><label className="search-shell"><Icon name="search" /><span className="sr-only">플레이어 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="플레이어 이름 검색" /></label><button className="reload-button" type="button" onClick={reload} disabled={loading}><Icon name="refresh" />새로고침</button></div>
    {error ? <StateCard type="error" title="순위 정보를 불러오지 못했습니다." description={`${error} · 서버에 공개 순위 API가 배포되어 있고 GitHub Pages 주소가 CORS_ORIGINS에 등록되어 있는지 확인하세요.`} action={<button className="primary-button" onClick={reload}>다시 시도</button>} />
      : loading ? <div className="ranking-list" aria-busy="true">{Array.from({ length: 6 }, (_, index) => <div className="ranking-row ranking-skeleton" key={index}><i /><i /><i /><i /></div>)}</div>
      : filtered.length ? <div className="ranking-list"><div className="ranking-head" aria-hidden="true"><span>RANK</span><span>PLAYER</span><span>TIER / STATUS</span><span>RECORD</span></div>{filtered.map((player) => {
        const originalRank = players.indexOf(player) + 1;
        const isPlacement = player.tier === "UNRANKED" || player.visibleRankedScore === null;
        return <article className="ranking-row" key={`${player.player}-${originalRank}`}><strong className="rank-number">{String(originalRank).padStart(2, "0")}</strong><div className="player-name"><strong>{player.player}</strong><span>RANKED PLAYER</span></div><PlayerStatus player={player} /><div className={`record-line${isPlacement ? " placement-record" : ""}`}>{isPlacement ? <span>배치 진행 중</span> : <><strong>{player.wins} <small>wins</small></strong><strong>{player.draws} <small>draw</small></strong><strong>{player.losses} <small>lose</small></strong><b>({formatWinRate(player)}%)</b></>}</div></article>;
      })}</div> : <StateCard title={players.length ? "검색 결과가 없습니다." : "표시할 플레이어가 없습니다."} description={players.length ? "플레이어 이름을 다시 확인하세요." : "Ranked DB에 생성된 플레이어가 생기면 여기에 표시됩니다."} />}
  </section>;
}

function Information({ maps, mapsLoading, tiers, config, loading, error, reload }) {
  const poolCounts = useMemo(() => POOLS.map((pool) => maps.filter((map) => map.pool === pool).length), [maps]);
  const placementGames = Number(config.placementGames) || 0;
  const promotionBonus = Number(config.promotionScoreBonus) || 0;
  const promotionPenalty = Number(config.promotionFailurePenalty) || 0;
  const demotionPenalty = Number(config.demotionScorePenalty) || 0;
  return <section className="tab-page">
    <div className="page-heading composition-heading"><div><p className="section-kicker">RANKED RULES / LIVE CONFIG</p><h1>Ranked Info</h1><p>현재 운영 시트의 티어 커트, 승급전 설정과 풀 구성, 승급·강등 규칙입니다.</p></div><button className="reload-button" type="button" onClick={reload} disabled={loading}><Icon name="refresh" />정보 새로고침</button></div>
    {error ? <StateCard type="error" title="운영 정보를 불러오지 못했습니다." description={error} action={<button className="primary-button" onClick={reload}>다시 시도</button>} /> : <>
      <div className="rule-summary-grid"><article className="rule-summary-card"><span>PLACEMENT</span><strong>{loading ? "—" : placementGames}</strong><p>배치 경기 완료 후 LP와 티어 공개</p></article><article className="rule-summary-card"><span>PROMOTION SUCCESS</span><strong>{loading ? "—" : `+${promotionBonus}`}</strong><p>다음 티어 커트 기준 보너스 LP</p></article><article className="rule-summary-card"><span>PROMOTION FAILED</span><strong>{loading ? "—" : `-${promotionPenalty}`}</strong><p>승급 커트 기준 차감 LP</p></article><article className="rule-summary-card danger-card"><span>DEMOTION</span><strong>{loading ? "—" : `-${demotionPenalty}`}</strong><p>현재 티어 커트 기준 차감 LP</p></article></div>
      <div className="info-section-shell"><div className="composition-title-line"><div><p className="section-kicker">TIER BANDS</p><h2>티어 커트 · 승급전</h2></div><span>운영 시트 실시간</span></div><div className="table-scroll"><table className="tier-rule-table"><thead><tr><th>티어</th><th>LP 구간</th><th>승급</th><th>메인 풀</th><th>데스매치 풀</th></tr></thead><tbody>{loading ? <tr><td colSpan="5">불러오는 중…</td></tr> : tiers.map((tier, index) => {
        const target = tiers[index + 1]?.tier;
        return <tr key={tier.tier}><td><TierBadge tier={tier.tier} /></td><td><strong>{tier.minimum.toLocaleString()} ~ {tier.maximum === null ? "∞" : (tier.maximum - 1).toLocaleString()} LP</strong></td><td>{target ? <><strong>{tier.tier} → {target}</strong><small>{tier.promotionGames}전 {tier.promotionWinsRequired}승</small></> : <strong>최상위 티어</strong>}</td><td>Pool {tier.mainPool}</td><td>Pool {tier.deathmatchPool}</td></tr>;
      })}</tbody></table></div></div>
      <div className="demotion-panel"><div><p className="section-kicker">DEMOTION POLICY</p><h2>강등 조건</h2></div><ol><li>RED를 제외하고, 패배 시 LP가 현재 티어 커트까지 내려가며 내부 등급 평가도 커트 미만이면 <strong>강등 경고</strong>가 켜집니다.</li><li>경고 상태에서 같은 강등 조건을 충족하는 결정 패배가 다시 발생하면 한 단계 강등되고 <strong>현재 커트 - {demotionPenalty || "—"} LP</strong>가 적용됩니다.</li><li>승리하면 강등 경고가 해제되며, 무승부는 경고 상태를 바꾸지 않습니다.</li></ol></div>
      <div className="pool-count-strip">{POOLS.map((pool, index) => <div className={`pool-count pool-${pool}`} key={pool}><span>POOL {pool}</span><strong>{mapsLoading ? "—" : poolCounts[index]}</strong><small>등록 맵</small></div>)}</div>
      <div className="composition-table-shell"><div className="composition-title-line"><div><p className="section-kicker">5 MAP CANDIDATES</p><h2>티어별 풀 등장 개수</h2></div><span>합계 5개</span></div><div className="table-scroll"><table><thead><tr><th>티어</th>{POOLS.map((pool) => <th key={pool}>Pool {pool}</th>)}<th>합계</th></tr></thead><tbody>{TIER_POOL_DISTRIBUTION.map(({ tier, counts }) => <tr key={tier}><td><TierBadge tier={tier} /></td>{counts.map((count, index) => <td key={`${tier}-${index}`}><span className={`distribution-value${count ? " is-active" : ""}`}>{count || "—"}</span></td>)}<td><strong className="distribution-total">5</strong></td></tr>)}</tbody></table></div></div>
    </>}
  </section>;
}

function tabFromHash() {
  if (window.location.hash === "#ranking") return "ranking";
  if (window.location.hash === "#info" || window.location.hash === "#pools") return "info";
  return "list";
}

function App() {
  const [tab, setTab] = useState(tabFromHash);
  const { theme, toggleTheme } = useTheme();
  const rankedMaps = useRankedMaps();
  const leaderboard = useLeaderboard();
  const information = useRankedInformation();
  const changeTab = (value) => {
    setTab(value);
    history.replaceState(null, "", `#${value}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  return <div className="site-shell"><div className="spectrum-line" /><header className="site-header-wrap"><div className="site-header"><div className="brand"><span>CORUM</span><strong>RANKED</strong></div><div className="header-actions"><nav className="site-tabs" aria-label="사이트 메뉴"><button className={tab === "list" ? "active" : ""} onClick={() => changeTab("list")}><Icon name="list" />맵 리스트</button><button className={tab === "ranking" ? "active" : ""} onClick={() => changeTab("ranking")}><Icon name="rank" />순위</button><button className={tab === "info" ? "active" : ""} onClick={() => changeTab("info")}><Icon name="info" />정보</button></nav><button className="header-button" onClick={toggleTheme} aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}><Icon name={theme === "dark" ? "sun" : "moon"} /><span>{theme === "dark" ? "LIGHT" : "DARK"}</span></button><button className="header-button mod-button" disabled title="모드 다운로드 준비 중"><Icon name="download" /><span>모드</span></button></div></div></header><main className="content">{tab === "list" && <MapList {...rankedMaps} />}{tab === "ranking" && <Ranking {...leaderboard} />}{tab === "info" && <Information maps={rankedMaps.maps} mapsLoading={rankedMaps.loading} {...information} />}</main><footer className="footer"><div><strong>CORUM RANKED</strong><span>Official Ranked pool & leaderboard</span></div><span>DATA · SHEET2 + RANKED DB API</span></footer></div>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
