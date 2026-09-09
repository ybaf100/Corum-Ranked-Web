import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./placement.css";
import { Reveal, Disclosure, scrollToSection, useStickyOffsets } from "./motion.jsx";
import { StageRunDemo, ClearDemo, ScoreDemo, StageGradeDemo } from "./rule-demos.jsx";
import { csvObjects, normalizeLeaderboard, loadRankedMaps, fetchText, placementDisplay } from "./ranked-data.js";
import { TierArtwork, ArtworkBackdrop, RankShowcase, RankGallery } from "./artwork.jsx";
import "./showcase.css";
import { CopyMapCode } from "./copy-map-code.jsx";
import { MatchJourney } from "./match-journey.jsx";
import "./interaction.css";

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
  0: "#e8eaed", Tiny: "#ff6fff", 1: "#0099ff", 2: "#00bbff", 3: "#00ddff", 4: "#00ffff",
  5: "#00ffaa", 6: "#00ff00", 7: "#66ff00", 8: "#99ff00", 9: "#ccff00", 10: "#ffff00",
  11: "#ffdd00", 12: "#ffcc00", 13: "#ffaa00", 14: "#ff8800", 15: "#ff6600", 16: "#ff4400",
  17: "#ff0000", 18: "#cc0000", "18+": "#a61c00", 19: "#660000", "19+": "#460c00", "20.0": "#360900",
  20.1: "#240600", 20.2: "#130400", 20.3: "#000000", 20.4: "#0a031f", 20.5: "#11072d", 20.6: "#180b3b",
  20.7: "#180b3b", 20.8: "#261358", 20.9: "#2d1766", 21: "#351c75", "21+": "#4511c9",
};

const MATCH_FLOW = [
  { step: "01", eyebrow: "MATCH FOUND", title: "매칭 · 밴", description: "두 플레이어의 Hidden MMR 평균으로 effective tier와 맵 후보를 정하고 10초 밴 페이즈를 진행합니다." },
  { step: "02", eyebrow: "OPENING", title: "Round 1", description: "첫 번째 맵에서 일반 라운드를 진행합니다. 결과와 관계없이 Round 2로 이동합니다." },
  { step: "03", eyebrow: "MATCH POINT", title: "Round 2", description: "두 라운드 후 승수가 다르면 매치가 끝나고, 같으면 Round 3으로 이동합니다." },
  { step: "04", eyebrow: "TIEBREAKER", title: "Round 3", description: "비무승부면 최종 승자가 정해지고, 라운드 무승부면 Death Match로 이동합니다." },
  { step: "05", eyebrow: "IF TIED", title: "Death Match", description: "각자 정확히 3 scored Attempts 중 authoritative raw progress percentage의 최고값 1개를 비교합니다. Qualifying %와 일반 Attempt 점수 배율은 적용하지 않으며 Clear는 100%입니다. 최고 진행률이 같으면 새 맵으로 반복합니다." },
];

const ROUND_RULES = [
  { value: "5:00", label: "MAIN TIME", title: "일반 라운드", description: "5분 동안 새 Attempt를 시작할 수 있습니다." },
  { value: "+0:10", label: "FINAL ATTEMPT", title: "마지막 시작 구간", description: "5분 뒤 10초 동안 추가 Attempt 시작이 가능합니다. 이미 시작된 Attempt는 자연 종료까지 정산됩니다." },
  { value: "3", label: "CLEAR TARGET", title: "3-Clear", description: "한쪽이 3 Clears에 도달하면 상대에게 별도 LAST ATTEMPT 창이 열립니다." },
  { value: "10s", label: "LAST ATTEMPT", title: "동점 기회", description: "상대가 10초 안에 필요한 Attempt를 시작해 3 Clears를 맞추면 라운드 무승부, 실패하면 trigger side가 승리합니다." },
];

const SCORE_RULES = [
  { range: "< Qualifying", score: "0점", detail: "기준 미달" },
  { range: "Qualifying–<50%", score: "진행률", detail: "floor(progress)" },
  { range: "50–<75%", score: "× 1.5", detail: "floor(progress) 기준" },
  { range: "75–<100%", score: "× 2", detail: "floor(progress) 기준" },
  { range: "100%", score: "250점", detail: "+ 1 Clear" },
];

const PLACEMENT_GRADES = [
  { grade: "S", range: "425–500", movement: "+1", detail: "두 맵 모두 S면 +2" },
  { grade: "A", range: "350–<425", movement: "+1", detail: "다음 Stage Pool 상승" },
  { grade: "B", range: "250–<350", movement: "0", detail: "Pool 유지" },
  { grade: "C", range: "150–<250", movement: "−1", detail: "다음 Stage Pool 하락" },
  { grade: "D", range: "0–<150", movement: "−1", detail: "두 맵 모두 D면 −2" },
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
  if (name === "arrow") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5" {...common} /></svg>;
  if (name === "back") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M10 7l-5 5 5 5" {...common} /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" {...common} /><path d="m16 16 4 4" {...common} /></svg>;
}

function parseTierRules(csv) {
  return csvObjects(csv).flatMap((row) => {
    const tier = String(row.Tier || "").toUpperCase(); const minimum = Number(row["최소 점수(포함)"]); const maximumText = row["최대 점수(미포함)"];
    if (!TIER_ORDER.includes(tier) || tier === "UNRANKED" || !Number.isFinite(minimum)) return [];
    return [{ tier, minimum, maximum: maximumText === "" ? null : Number(maximumText), mainPool: Number(row["Main Pool"]), deathmatchPool: Number(row["Deathmatch Pool"]), promotionGames: Number(row["Promotion Games"]), promotionWinsRequired: Number(row["Promotion Wins Required"]) }];
  }).sort((a, b) => a.minimum - b.minimum);
}
function parseRankedConfig(csv) {
  const config = {};
  csvObjects(csv).forEach((row) => { const key = row.Key || row.key || Object.values(row)[0]; const raw = row.Value ?? row.value ?? Object.values(row)[1]; if (key) config[key] = raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw; });
  return config;
}
function difficultyIndex(value) { return DIFFICULTY_ORDER.indexOf(/^20(?:\.0+)?$/.test(value) ? "20.0" : value); }
function difficultyTextColor(value) {
  const hex = (DIFFICULTY_COLORS[value] || "#e8eaed").replace("#", ""); const r = Number.parseInt(hex.slice(0, 2), 16); const g = Number.parseInt(hex.slice(2, 4), 16); const b = Number.parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? "#07080d" : "#ffffff";
}
function poolDistribution(mainPool) {
  const counts = [0, 0, 0, 0, 0, 0];
  if (mainPool === 1) { counts[0] = 2; counts[1] = 2; counts[2] = 1; }
  else if (mainPool === 6) { counts[3] = 1; counts[4] = 2; counts[5] = 2; }
  else if (mainPool >= 2 && mainPool <= 5) { counts[mainPool - 2] = 1; counts[mainPool - 1] = 3; counts[mainPool] = 1; }
  return counts;
}

function getInitialTheme() {
  const current = document.documentElement.dataset.theme; if (current === "light" || current === "dark") return current;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#080a0e" : "#f5f5f7"); try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (_) {} }, [theme]);
  return { theme, toggleTheme: () => setTheme((value) => value === "dark" ? "light" : "dark") };
}
function useRemoteData(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: "" }); const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => { const controller = new AbortController(); setState((current) => ({ ...current, loading: true, error: "" })); loader(controller.signal).then((data) => { if (!controller.signal.aborted) setState({ data, loading: false, error: "" }); }).catch((reason) => { if (!controller.signal.aborted) setState({ data: null, loading: false, error: reason instanceof Error ? reason.message : "데이터를 불러오지 못했습니다." }); }); return () => controller.abort(); }, [reloadKey]);
  return { ...state, reload: () => setReloadKey((value) => value + 1) };
}
function useRankedMaps() {
  const remote = useRemoteData((signal) => loadRankedMaps(`${RANKED_API_URL}/api/ranked/maps`, SHEET2_CSV_URL, signal));
  return { ...remote, maps: remote.data || [] };
}
function useLeaderboard() {
  const remote = useRemoteData(async (signal) => { const requestSignal = typeof AbortSignal.any === "function" && typeof AbortSignal.timeout === "function" ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : signal; const response = await fetch(`${LEADERBOARD_URL}?v=${Date.now()}`, { cache: "no-store", signal: requestSignal }); if (!response.ok) throw new Error(`Ranked 서버 요청 실패 (${response.status})`); return normalizeLeaderboard(await response.json()); });
  return { ...remote, players: remote.data?.players || [], serverOpen: remote.data?.serverOpen === true };
}
function useRankedInformation() { const remote = useRemoteData(async (signal) => { const [tierCsv, configCsv] = await Promise.all([fetchText(TIER_CSV_URL, signal), fetchText(CONFIG_CSV_URL, signal)]); return { tiers: parseTierRules(tierCsv), config: parseRankedConfig(configCsv) }; }); return { ...remote, tiers: remote.data?.tiers || [], config: remote.data?.config || {} }; }

function DifficultyBadge({ value }) { return <span className="difficulty-badge" style={{ background: DIFFICULTY_COLORS[value] || "#e8eaed", color: difficultyTextColor(value) }}>{value}</span>; }
function TierBadge({ tier }) { return <span className={`tier-badge tier-${tier.toLowerCase()}`}>{tier}</span>; }
function ServerStatus({ loading, error, serverOpen }) {
  const open = !loading && !error && serverOpen;
  const label = loading ? "서버 확인 중" : error ? "상태 확인 불가" : open ? "서버 열림" : "서버 닫힘";
  return <div className={"server-status " + (open ? "is-open" : loading || error ? "is-unknown" : "is-closed")} role="status" aria-live="polite"><i aria-hidden="true" /><span>{label}</span></div>;
}
function PageHeading({ number, label, title, description, count, countLabel, action, artworkTier }) {
  return <div className="page-heading"><ArtworkBackdrop /><div className="page-heading-copy"><p className="section-kicker"><span>{number}</span> / {label}</p><h1>{title}<span className="heading-period" aria-hidden="true">.</span></h1><p className="page-description">{description}</p></div>{countLabel && <div className="total-counter"><strong>{count}</strong><span>{countLabel}</span></div>}{artworkTier && <TierArtwork tier={artworkTier} className="page-heading-artwork" variant="heading" priority />}{action}</div>;
}
function StateCard({ type, title, description, action }) { return <div className={`state-card ${type === "error" ? "error-state" : ""}`} role={type === "error" ? "alert" : undefined}><span>{type === "error" ? "LOAD FAILED" : "NO DATA"}</span><h2>{title}</h2><p>{description}</p>{action}</div>; }

function MapList({ maps, loading, error, reload }) {
  const [query, setQuery] = useState("");
  const [poolFilter, setPoolFilter] = useState("all");
  const assignedMaps = useMemo(() => maps.filter((map) => map.pool !== null), [maps]);
  const unassignedCount = maps.length - assignedMaps.length;
  const filteredMaps = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return assignedMaps.filter((map) => (!q || map.title.toLocaleLowerCase().includes(q) || map.mapCode.toLocaleLowerCase().includes(q)) && (poolFilter === "all" || map.pool === Number(poolFilter)))
      .sort((a, b) => a.pool - b.pool || difficultyIndex(a.difficulty) - difficultyIndex(b.difficulty) || a.title.localeCompare(b.title, "ko"));
  }, [assignedMaps, poolFilter, query]);
  return <section className="tab-page maps-page">
    <PageHeading number="01" label="COMPETITIVE MAPS" title="Map index" description="맵을 고르고, 다음 도전을 준비하세요." count={loading || error ? "—" : assignedMaps.length} countLabel="ACTIVE MAPS" />
    <div className="map-workspace">
      <aside className="pool-directory" aria-label="Ranked Pool 필터">
        <div className="directory-heading"><span>POOL DIRECTORY</span><span>01—06</span></div>
        <div className="pool-filters">
          <button type="button" className={poolFilter === "all" ? "selected" : ""} onClick={() => setPoolFilter("all")} aria-pressed={poolFilter === "all"}><span>전체 맵</span><b>{loading || error ? "—" : assignedMaps.length}</b></button>
          {POOLS.map((pool) => <button type="button" key={pool} className={poolFilter === String(pool) ? "selected" : ""} onClick={() => setPoolFilter(String(pool))} aria-pressed={poolFilter === String(pool)}><span><i aria-hidden="true">/</i> Pool {pool}</span><b>{loading || error ? "—" : assignedMaps.filter((map) => map.pool === pool).length}</b></button>)}
        </div>
        <div className="directory-note"><Icon name="info" /><p><strong>Qualifying %</strong>해당 진행률부터 Attempt 점수가 인정됩니다.</p></div>
      </aside>
      <div className="map-results">
        <div className="list-toolbar"><label className="search-shell"><Icon name="search" /><span className="sr-only">맵 검색</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="맵 제목 또는 맵 코드 검색" /></label><button className="reload-button" type="button" aria-label="데이터 새로고침" onClick={reload} disabled={loading}><Icon name="refresh" /><span>새로고침</span></button></div>
        {error ? <StateCard type="error" title="맵 목록을 불러오지 못했습니다." description={error} action={<button className="primary-button" onClick={reload}>다시 시도</button>} />
          : loading ? <div className="map-list" aria-busy="true" aria-label="맵 목록 불러오는 중">{Array.from({ length: 7 }, (_, index) => <div className="map-row skeleton-row" key={index}><i /><i /><i /><i /><i /></div>)}</div>
          : <><div className="result-line" role="status"><span>{poolFilter === "all" ? "ALL POOLS" : "POOL " + poolFilter}<b>{filteredMaps.length} MAPS</b></span>{unassignedCount > 0 && <small>Pool 미배정 {unassignedCount}개 제외</small>}</div>
            {filteredMaps.length ? <div className="map-list">
              <div className="map-list-head" aria-hidden="true"><span>POOL</span><span>맵 제목</span><span>난이도</span><span>맵 코드</span><span>QUALIFYING</span></div>
              {filteredMaps.map((map) => <article className="map-row" data-pool={map.pool} key={map.mapCode + "-" + map.title}>
                <div className="pool-mark"><span>POOL</span><strong>{String(map.pool).padStart(2, "0")}</strong></div>
                <div className="map-title"><h2>{map.title}</h2></div>
                <div className="map-difficulty"><span className="mobile-field-label">난이도</span><DifficultyBadge value={map.difficulty} /></div>
                <CopyMapCode code={map.mapCode} />
                <div className="qualifying"><span>QUALIFYING</span><strong>{map.qualifyingPercent !== "" ? map.qualifyingPercent + "%" : "—"}</strong><div className="qualifying-track" aria-hidden="true"><i style={{ width: Math.min(100, Math.max(0, Number(map.qualifyingPercent) || 0)) + "%" }} /></div></div>
              </article>)}</div> : <StateCard title={assignedMaps.length ? "검색 결과가 없습니다." : "배정된 맵이 없습니다."} description={assignedMaps.length ? "검색어나 Pool 필터를 변경해 보세요." : "Ranked Pool에 등록된 맵이 여기에 표시됩니다."} />}</>}
      </div>
    </div>
  </section>;
}
function formatMarks(results, required) { const known = Number.isFinite(required) && required > 0; const length = known ? required : results.length; const marks = results.slice(0, length).map((result) => result === "WIN" ? "O" : "X"); return `${marks.join("")}${"-".repeat(Math.max(0, length - marks.length))}` || "—"; }
function formatWinRate(player) { const total = player.wins + player.losses; if (!total) return "0"; const rate = player.wins / total * 100; return Number.isInteger(rate) ? String(rate) : rate.toFixed(1); }
function PlayerStatus({ player }) {
  if (player.tier === "UNRANKED" || player.visibleRankedScore === null) {
    const status = placementDisplay(player.placement);
    return <div className="player-status placement-player-status"><TierBadge tier="UNRANKED" /><strong className="placement-stage-label">{status.title}</strong><small>{status.detail}</small>{status.totalStages && <div className="placement-stage-progress" aria-label={`${status.completedStages} / ${status.totalStages} Stage 완료`}>{Array.from({ length: status.totalStages }, (_, index) => <span key={index} className={index < status.completedStages ? "is-complete" : index + 1 === status.currentStageIndex ? "is-current" : ""} aria-hidden="true">{index < status.completedStages ? "✓" : index + 1}</span>)}</div>}</div>;
  }
  if (player.promotion) return <div className="player-status"><TierBadge tier={player.promotion.sourceTier} /><strong className="series-marks" aria-label={formatMarks(player.promotion.results, player.promotion.gamesRequired).split("").map((mark) => mark === "O" ? "승리" : mark === "X" ? "패배" : "미진행").join(", ")}>{formatMarks(player.promotion.results, player.promotion.gamesRequired).split("").map((mark, index) => <span key={index} className={mark === "O" ? "series-win" : mark === "X" ? "series-loss" : "series-pending"} aria-hidden="true">{mark}</span>)}</strong><small>{player.promotion.targetTier} 승급전 · {player.promotion.winsRequired}승 필요</small></div>;
  return <div className="player-status"><TierBadge tier={player.tier} /><strong className="lp-value">{Number.isFinite(player.visibleRankedScore) ? player.visibleRankedScore.toLocaleString() : "—"} LP</strong>{player.demotionWarning && <small className="warning-label">강등 경고</small>}</div>;
}
function PlayerRecord({ player }) {
  return <div className="record-line"><div className="record-numbers"><strong>{player.wins}<small>승</small></strong><span>/</span><strong>{player.losses}<small>패</small></strong><b>{formatWinRate(player)}<small>%</small></b></div><div className="win-rate-track" aria-hidden="true"><i style={{ width: formatWinRate(player) + "%" }} /></div></div>;
}
function RankingRows({ players, rankedPlayers, unranked = false }) {
  return <div className={unranked ? "ranking-list unranked-list" : "ranking-list"}>
    <div className="ranking-head" aria-hidden="true"><span>{unranked ? "—" : "순위"}</span><span>플레이어</span><span>{unranked ? "PLACEMENT" : "티어 / 상태"}</span><span>전적 / 승률</span></div>
    {players.map((player) => {
      const rank = unranked ? null : rankedPlayers.indexOf(player) + 1;
      return <article className={"ranking-row" + (unranked ? " unranked-row" : "") + (rank === 1 ? " first-rank" : "")} key={player.player}>
        <strong className="rank-number">{rank === null ? "—" : String(rank).padStart(2, "0")}</strong>
        <div className="player-identity"><TierArtwork tier={unranked ? "UNRANKED" : player.promotion?.sourceTier || player.tier} /><div className="player-name"><strong>{player.player}</strong><span>{unranked ? placementDisplay(player.placement).progress : "RANKED PLAYER"}</span></div></div>
        <PlayerStatus player={player} /><PlayerRecord player={player} />
      </article>;
    })}
  </div>;
}
function Ranking({ players, loading, error, reload }) {
  const [query, setQuery] = useState("");
  const rankedPlayers = useMemo(() => players.filter((player) => player.tier !== "UNRANKED" && player.visibleRankedScore !== null), [players]);
  const unrankedPlayers = useMemo(() => players.filter((player) => player.tier === "UNRANKED" || player.visibleRankedScore === null), [players]);
  const q = query.trim().toLocaleLowerCase();
  const rankedFiltered = useMemo(() => rankedPlayers.filter((player) => player.player.toLocaleLowerCase().includes(q)), [rankedPlayers, q]);
  const unrankedFiltered = useMemo(() => unrankedPlayers.filter((player) => player.player.toLocaleLowerCase().includes(q)), [unrankedPlayers, q]);
  const hasResults = rankedFiltered.length + unrankedFiltered.length > 0;
  return <section className="tab-page ranking-page">
    <PageHeading number="02" label="PUBLIC STANDINGS" title="Leaderboard" description="티어, LP, 그리고 기록. 현재의 순위를 확인하세요." count={loading || error ? "—" : players.length} countLabel="PLAYERS" />
    <div className="list-toolbar ranking-toolbar"><label className="search-shell"><Icon name="search" /><span className="sr-only">플레이어 검색</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="플레이어 이름 검색" /></label><button className="reload-button" type="button" aria-label="데이터 새로고침" onClick={reload} disabled={loading}><Icon name="refresh" /><span>새로고침</span></button></div>
    {error ? <StateCard type="error" title="순위 정보를 불러오지 못했습니다." description={error + " · 잠시 후 다시 시도해 주세요."} action={<button className="primary-button" onClick={reload}>다시 시도</button>} />
      : loading ? <div className="ranking-list" aria-busy="true" aria-label="순위 불러오는 중">{Array.from({ length: 6 }, (_, index) => <div className="ranking-row ranking-skeleton" key={index}><i /><i /><i /><i /></div>)}</div>
      : hasResults ? <>
        {rankedFiltered.length > 0 && <><div className="result-line"><span>RANKED<b>{rankedFiltered.length} PLAYERS</b></span><small>Hidden MMR 비공개 · 서버 순위 기준</small></div><RankingRows players={rankedFiltered} rankedPlayers={rankedPlayers} /></>}
        {unrankedFiltered.length > 0 && <div className="unranked-section"><div className="unranked-heading"><div><p className="section-kicker">NEXT IN LINE</p><h2>Unranked<span className="heading-period">.</span></h2></div><span>{unrankedFiltered.length} PLAYERS</span></div><RankingRows players={unrankedFiltered} rankedPlayers={rankedPlayers} unranked /></div>}
      </> : <StateCard title={players.length ? "검색 결과가 없습니다." : "표시할 플레이어가 없습니다."} description={players.length ? "플레이어 이름을 다시 확인하세요." : "공개 Ranked 플레이어가 등록되면 여기에 표시됩니다."} />}
    <p className="data-footnote">Ranked가 닫혀 있어도 공개 데이터 조회가 가능하면 순위를 표시합니다. 정렬은 서버의 공개 순위 기준을 따릅니다.</p>
  </section>;
}

function MatchProgression() {
  return <section className="match-format-section" id="match-format" tabIndex="-1" aria-labelledby="match-format-title">
    <MatchJourney phases={MATCH_FLOW} />
    <Reveal className="round-rules-section">
      <div className="composition-title-line"><div><p className="section-kicker">NORMAL ROUND</p><h2>한 라운드의 기준.</h2></div><span>5:00 / 3 CLEAR</span></div>
      <div className="round-rule-grid">
        {ROUND_RULES.map((rule) => <details className="round-rule-card" key={rule.label}>
          <summary><span className="round-stat"><strong>{rule.value}</strong><span>{rule.label}</span></span><span className="round-rule-title"><strong>{rule.title}</strong><i aria-hidden="true">+</i></span></summary>
          <p>{rule.description}</p>
        </details>)}
      </div>
      <ClearDemo />
    </Reveal>
    <Reveal className="score-rule-shell">
      <Disclosure eyebrow="ROUND SCORING" title="Attempt 점수">
        <p className="score-introduction">맵별 Qualifying 기준을 통과한 뒤 구간별 배율을 적용합니다.</p>
        <ScoreDemo />
        <div className="score-rule-grid">{SCORE_RULES.map((rule) => <div className="score-rule" key={rule.range}><span>{rule.range}</span><strong>{rule.score}</strong><small>{rule.detail}</small></div>)}</div>
      </Disclosure>
    </Reveal>
    <Reveal className="authority-note"><span>SERVER AUTHORITATIVE</span><p>시간, Attempt 승인, 점수, Clear, 라운드와 최종 승자는 Ranked 서버가 판정합니다. 최종 매치 draw는 없고 승자가 나올 때까지 Death Match가 반복됩니다.</p></Reveal>
  </section>;
}

function RankedPolicyOverview() {
  return <section className="policy-section" id="ranked-policy" tabIndex="-1">
    <Reveal className="chapter-heading"><p className="section-kicker">02 / RANK & PROGRESSION</p><h2>랭크를 만드는 기준.</h2></Reveal>
    <Reveal><RankGallery /></Reveal>
    <div className="ranked-policy-grid">
      <Reveal><Disclosure className="policy-card policy-card-1" eyebrow="HIDDEN MMR / VISIBLE LP" title="MMR과 LP"><p>Hidden MMR은 매칭과 LP 보정에 사용되지만 공개되지 않습니다. MMR이 현재 LP보다 높으면 승리 시 더 많이 오르고 패배 시 덜 내려가며, 낮으면 반대로 적용됩니다. 상대의 강약도 함께 반영됩니다.</p></Disclosure></Reveal>
      <Reveal><Disclosure className="policy-card policy-card-2" eyebrow="PERFECT WIN" title="Perfect Win"><p>최종 승자가 한 Round도 패배하지 않고, 모든 결정 승리를 실제 3-Clear로 만든 경우에만 인정됩니다. Round draw는 허용되지만 score win, forfeit, forced win, Death Match 승리는 조건을 만족하지 않습니다.</p></Disclosure></Reveal>
      <Reveal><Disclosure className="policy-card policy-card-3" eyebrow="PROMOTION" title="승급전"><p>예상 승리 LP가 다음 cutoff에 닿기 전에 LP를 cutoff−1에 고정하고 승급전을 시작합니다. 승급전 중에도 Hidden MMR과 streak는 계속 변하며, 필요한 판수와 승수는 운영 시트의 티어 설정을 따릅니다.</p></Disclosure></Reveal>
    </div>
  </section>;
}

function PlacementSummary({ onOpenPlacement }) {
  return <Reveal as="section" className="placement-summary" id="placement-summary" tabIndex="-1">
    <div className="placement-summary-copy">
      <p className="section-kicker">03 / SOLO STAGE PLACEMENT</p>
      <h2>배치 경기<span>.</span></h2>
      <p>현재 Placement는 PvP가 아니라 싱글플레이 Stage 방식입니다. 3 Stage 또는 5 Stage를 선택하고, Stage마다 서로 다른 2개 맵을 플레이해 Map Score와 Grade를 쌓습니다.</p>
      <button className="placement-detail-button" type="button" onClick={onOpenPlacement}>자세히 보기 <Icon name="arrow" /></button>
    </div>
    <div className="placement-summary-visual">
      <div className="placement-lengths" aria-label="3 Stage 또는 5 Stage"><strong>3</strong><span>or</span><strong>5</strong></div>
      <div className="placement-summary-facts"><span><strong>3 / 5</strong> STAGES</span><span><strong>2</strong> MAPS / STAGE</span><span><strong>3:00</strong> MAP TIME</span><span><strong>2</strong> CLEAR TARGET</span></div>
      <StageRunDemo stages={3} compact />
    </div>
  </Reveal>;
}

function Information({ maps, mapsLoading, tiers, config, loading, error, reload, onOpenPlacement }) {
  const poolCounts = useMemo(() => POOLS.map((pool) => maps.filter((map) => map.pool === pool).length), [maps]);
  const demotionPenalty = Number(config.demotionScorePenalty) || 0;
  return <section className="tab-page information-page">
    <header className="guide-hero">
      <ArtworkBackdrop />
      <div className="guide-hero-copy">
        <p className="section-kicker">CORUM RANKED / RULES & FORMAT</p>
        <h1>The rulebook<span>.</span></h1>
        <p>첫 매칭부터 승급까지. 플레이에 필요한 모든 기준.</p>
        <button className="text-link" type="button" onClick={() => scrollToSection("match-format")}>진행 방식 살펴보기 <Icon name="arrow" /></button>
      </div>
      <RankShowcase />
    </header>
    <div className="chapter-links" role="group" aria-label="정보 목차">
      {[["match-format","진행 방식"],["ranked-policy","랭크와 점수"],["placement-summary","배치 경기"],["ranked-tiers","티어와 Pool"]].map(([id,label], index) => <button key={id} type="button" onClick={() => scrollToSection(id)}><span>0{index + 1}</span>{label}</button>)}
    </div>
    <MatchProgression />
    <RankedPolicyOverview />
    <PlacementSummary onOpenPlacement={onOpenPlacement} />
    <section className="live-information" id="ranked-tiers" tabIndex="-1">
      <Reveal className="chapter-heading live-heading"><div><p className="section-kicker">04 / LIVE TIER & POOL DATA</p><h2>티어와 Pool.</h2></div><button className="reload-button" type="button" aria-label="데이터 새로고침" onClick={reload} disabled={loading}><Icon name="refresh" />정보 새로고침</button></Reveal>
      {error ? <StateCard type="error" title="운영 정보를 불러오지 못했습니다." description={error} action={<button className="primary-button" onClick={reload}>다시 시도</button>} /> : <>
        <Reveal className="info-section-shell">
          <Disclosure eyebrow="TIER BANDS · 운영 시트 실시간" title="티어 커트 · 승급전" open>
            <div className="table-scroll" role="region" aria-label="티어 커트와 승급전 표" tabIndex="0"><table className="tier-rule-table"><thead><tr><th>티어</th><th>LP 구간</th><th>승급</th><th>Main Pool</th><th>Deathmatch Pool</th></tr></thead><tbody>{loading ? <tr><td colSpan="5">불러오는 중…</td></tr> : tiers.map((tier, index) => {
              const target = tiers[index + 1]?.tier;
              return <tr key={tier.tier}><td><TierBadge tier={tier.tier} /></td><td><strong>{tier.minimum.toLocaleString()} ~ {tier.maximum === null ? "∞" : (tier.maximum - 1).toLocaleString()} LP</strong></td><td>{target ? <><strong>{tier.tier} → {target}</strong><small>{tier.promotionGames}전 {tier.promotionWinsRequired}승</small></> : <strong>최상위 티어</strong>}</td><td>Pool {tier.mainPool}</td><td>Pool {tier.deathmatchPool}</td></tr>;
            })}</tbody></table></div>
          </Disclosure>
        </Reveal>
        <Reveal className="demotion-panel">
          <Disclosure eyebrow="DEMOTION POLICY" title="강등 조건">
            <ol><li>패배 예상 LP가 현재 tier floor 아래면 먼저 LP를 floor에 고정합니다.</li><li>Hidden MMR이 floor 이상이면 경고 없이 floor를 유지합니다. Hidden MMR도 floor 미만이면 첫 qualifying loss에서 <strong>DEMOTION WARNING</strong>이 켜집니다.</li><li>경고 상태에서 다음 qualifying loss가 발생하면 강등됩니다.{demotionPenalty ? <> 기본 운영값은 새 tier 기준 <strong>{demotionPenalty} LP</strong> penalty를 사용합니다.</> : null} 승리하면 경고가 해제됩니다.</li></ol>
          </Disclosure>
        </Reveal>
        <Reveal className="pool-count-strip">{POOLS.map((pool, index) => <div className={`pool-count pool-${pool}`} key={pool}><span>POOL {pool}</span><strong>{mapsLoading ? "—" : poolCounts[index]}</strong><small>등록 맵</small></div>)}</Reveal>
        <Reveal className="composition-table-shell">
          <Disclosure eyebrow="5 MAP CANDIDATES · 합계 5개" title="Main Pool별 후보 분포">
            <div className="table-scroll" role="region" aria-label="Main Pool별 5맵 후보 분포 표" tabIndex="0"><table><thead><tr><th>티어</th><th>Main</th>{POOLS.map((pool) => <th key={pool}>Pool {pool}</th>)}<th>합계</th></tr></thead><tbody>{loading ? <tr><td colSpan="9">불러오는 중…</td></tr> : tiers.map((tier) => {
              const counts = poolDistribution(tier.mainPool);
              return <tr key={`dist-${tier.tier}`}><td><TierBadge tier={tier.tier} /></td><td><strong>Pool {tier.mainPool}</strong></td>{counts.map((count, index) => <td key={`${tier.tier}-${index}`}><span className={`distribution-value${count ? " is-active" : ""}`}>{count || "—"}</span></td>)}<td><strong className="distribution-total">5</strong></td></tr>;
            })}</tbody></table></div>
          </Disclosure>
        </Reveal>
      </>}
    </section>
  </section>;
}

function PlacementInformation({ onBack }) { return <section className="tab-page placement-page"><div className="placement-page-nav"><button type="button" onClick={onBack}><Icon name="back" />정보로 돌아가기</button><span>RANKED INFO / PLACEMENT</span></div><PageHeading number="03.1" label="SOLO STAGE PLACEMENT" title="Find your rank" artworkTier="UNRANKED" description="혼자 플레이하고, 나의 출발점을 결정하세요. 현재 배치는 PvP가 아닌 싱글플레이 Stage Run입니다." /><div className="placement-mode-grid">{[3, 5].map((stages) => <Reveal as="article" key={stages}><div className="mode-card-heading"><span>{stages === 3 ? "QUICK RUN" : "FULL RUN"}</span><span>{stages * 2} MAPS</span></div><h2><strong>{stages}</strong> Stage</h2><StageRunDemo stages={stages} /><p>{stages === 3 ? <>총 6맵으로 빠르게 배치됩니다. 최종 Placement는 <b>AQUA 최상단</b>을 초과할 수 없습니다.</> : <>총 10맵을 플레이하며 <b>전체 Placement 범위</b>를 사용합니다.</>}</p></Reveal>)}</div><Reveal as="section" className="placement-detail-section"><div className="composition-title-line"><div><p className="section-kicker">01 / SETUP</p><h2>시작 Pool과 Run 길이</h2></div><span>시작 후 변경 불가</span></div><p>Run 시작 전에 3 Stage 또는 5 Stage와 본인이 생각하는 시작 실력대인 <b>POOL 1–POOL 6</b>을 선택합니다. 높은 Pool을 고른다고 최종 티어가 보장되지는 않습니다. 같은 Stage의 두 canonical map은 반드시 서로 다릅니다.</p><div className="placement-callout"><strong>SKIP PLACEMENT</strong><p>Run 시작 전에는 Placement를 건너뛸 수 있습니다. 확인하면 RED 150 LP로 배치가 확정되며 중복 적용되지 않습니다.</p></div></Reveal><Reveal as="section" className="placement-detail-section"><div className="composition-title-line"><div><p className="section-kicker">02 / MAP RULE</p><h2>각 맵 진행 방식</h2></div><span>3:00 + FINAL ATTEMPT</span></div><div className="placement-stat-grid"><article><strong>180s</strong><span>MAIN TIME</span><p>3분 동안 Attempt를 시작합니다.</p></article><article><strong>10s</strong><span>FINAL ATTEMPT</span><p>마지막 10초 안에 시작이 승인된 Attempt는 deadline 뒤에도 자연 종료까지 정산됩니다.</p></article><article><strong>2</strong><span>CLEAR TARGET</span><p>2 Clears를 달성하면 즉시 500점 · S Grade로 맵이 끝납니다.</p></article><article><strong>TOP 2</strong><span>MAP SCORE</span><p>유효 Attempt의 awarded score 중 상위 2개를 합산합니다.</p></article></div><ClearDemo placement /><div className="score-rule-shell placement-score-shell"><div className="score-rule-heading"><div><p className="section-kicker">SAME ATTEMPT CURVE</p><h3>Attempt 점수</h3></div><p>일반 Ranked와 동일한 scoring curve를 사용합니다.</p></div><div className="score-rule-grid">{SCORE_RULES.map((rule) => <div className="score-rule" key={`placement-${rule.range}`}><span>{rule.range}</span><strong>{rule.score}</strong><small>{rule.detail}</small></div>)}</div></div></Reveal><Reveal as="section" className="placement-detail-section"><div className="composition-title-line"><div><p className="section-kicker">03 / GRADE & POOL</p><h2>Map / Stage Grade</h2></div><span>Stage Score = 두 Map 평균</span></div><StageGradeDemo /><div className="placement-grade-grid">{PLACEMENT_GRADES.map((item) => <article className={`grade-${item.grade.toLowerCase()}`} key={item.grade}><strong>{item.grade}</strong><div><span>{item.range}</span><b>{item.movement}</b><small>{item.detail}</small></div></article>)}</div><p className="placement-muted">Stage Score는 두 Map Score의 평균입니다. Stage Grade에 따라 다음 Stage Pool이 이동하고 Pool은 1–6 범위로 제한됩니다.</p></Reveal><Reveal as="section" className="placement-detail-section"><div className="composition-title-line"><div><p className="section-kicker">04 / RESULT</p><h2>최종 배치 산정</h2></div><span>SERVER AUTHORITATIVE</span></div><div className="placement-result-flow"><article><span>1</span><h3>전체 evidence</h3><p>3 Stage는 6 Map + 3 Stage, 5 Stage는 10 Map + 5 Stage의 실제 score·Grade·Pool을 모두 사용합니다.</p></article><article><span>2</span><h3>Placement Rating</h3><p>Pool anchor와 normalized performance를 이용해 Placement Rating을 계산합니다.</p></article><article><span>3</span><h3>MMR → LP / Tier</h3><p>Placement Rating을 Hidden MMR로 연결한 뒤 기존 visible LP / Tier finalization을 적용합니다.</p></article><article><span>4</span><h3>Cutoff 보호</h3><p>non-lowest tier cutoff의 ±15 구간에는 배치하지 않고 cutoff−16으로 내려 경계 배치를 피합니다. 3 Stage에는 추가로 AQUA ceiling이 적용됩니다.</p></article></div></Reveal><Reveal as="section" className="placement-detail-section"><div className="composition-title-line"><div><p className="section-kicker">SAVE / RESUME</p><h2>중단 후 이어하기</h2></div><span>STATE PERSISTED</span></div><p>Stage Result에서 <b>PLAY LATER</b>를 선택하면 현재 Stage 결과가 서버에 저장되고, 이후 <b>CONTINUE PLACEMENT</b>로 이어서 진행할 수 있습니다. reconnect나 server restart 뒤에도 현재 Stage·Map·Attempt·result/finalization 상태를 복구하도록 설계되어 있습니다.</p></Reveal></section>; }

function tabFromHash() { if (window.location.hash === "#ranking") return "ranking"; if (window.location.hash === "#placement") return "placement"; if (window.location.hash === "#info" || window.location.hash === "#pools") return "info"; return "list"; }
function App() {
  const [tab, setTab] = useState(tabFromHash);
  useStickyOffsets(tab);
  const { theme, toggleTheme } = useTheme();
  const rankedMaps = useRankedMaps();
  const leaderboard = useLeaderboard();
  const information = useRankedInformation();
  useEffect(() => {
    const syncTab = () => { setTab(tabFromHash()); window.scrollTo({ top: 0, behavior: "auto" }); };
    window.addEventListener("hashchange", syncTab);
    return () => window.removeEventListener("hashchange", syncTab);
  }, []);
  const changeTab = (value) => { setTab(value); history.replaceState(null, "", "#" + value); window.scrollTo({ top: 0, behavior: "auto" }); };
  return <div className="site-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById("main-content")?.focus(); }}>본문으로 건너뛰기</a>
    <header className="site-header-wrap"><div className="site-header">
      <button type="button" className="brand" onClick={() => changeTab("list")} aria-label="Corum Ranked 맵 리스트"><span className="brand-symbol" aria-hidden="true">C<span>R</span></span><span className="brand-wordmark"><strong>CORUM</strong><span>RANKED</span></span></button>
      <nav className="site-tabs" aria-label="사이트 메뉴">{[{id:"list",label:"맵 리스트",number:"01"},{id:"ranking",label:"순위",number:"02"},{id:"info",label:"정보",number:"03"}].map((item) => {
        const active = tab === item.id || (tab === "placement" && item.id === "info");
        return <button type="button" key={item.id} className={active ? "active" : ""} onClick={() => changeTab(item.id)} aria-current={active ? "page" : undefined}><span aria-hidden="true">{item.number}</span>{item.label}</button>;
      })}</nav>
      <div className="header-actions"><ServerStatus loading={leaderboard.loading} error={leaderboard.error} serverOpen={leaderboard.serverOpen} /><button type="button" className="header-button theme-button" onClick={toggleTheme} aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"} title={theme === "dark" ? "라이트 모드" : "다크 모드"}><Icon name={theme === "dark" ? "sun" : "moon"} /></button><button type="button" className="header-button mod-button" aria-label="모드 다운로드 준비 중" disabled title="모드 다운로드 준비 중"><Icon name="download" /><span>모드<span className="soon-label">준비 중</span></span></button></div>
    </div></header>
    <main id="main-content" className="content" tabIndex="-1">
      {tab === "list" && <MapList {...rankedMaps} />}
      {tab === "ranking" && <Ranking {...leaderboard} />}
      {tab === "info" && <Information maps={rankedMaps.maps} mapsLoading={rankedMaps.loading} {...information} onOpenPlacement={() => changeTab("placement")} />}
      {tab === "placement" && <PlacementInformation onBack={() => changeTab("info")} />}
    </main>
    <footer className="footer"><div><strong>CORUM RANKED<span> / </span></strong><span>맵 · 순위 · 규칙</span></div><span>PUBLIC DATA / SHEET2 + RANKED API</span></footer>
  </div>;
}


createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
