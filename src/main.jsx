import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./pages.css";
import "./interaction.css";
import { useStickyOffsets } from "./motion.jsx";
import { csvObjects, fetchJson, fetchText, loadRankedMaps, loadTierGuide, normalizeLeaderboard, normalizeRankedConfig } from "./ranked-data.js";
import { MapList } from "./maps.jsx";
import { Ranking } from "./ranking.jsx";
import { Information, PlacementInformation } from "./info.jsx";
import { Icon } from "./ui.jsx";

const SHEET_BASE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRzHKOAa1pnP8TCB3d22TZwM5G3BgQSZhiFloApWA6mMptX6PdU_q6bKj8fs9IhpujO9WZ8Cln7e6vW/pub";
const SHEET2_CSV_URL = `${SHEET_BASE}?gid=1963044442&single=true&output=csv`;
const TIER_CSV_URL = `${SHEET_BASE}?gid=905346942&single=true&output=csv`;
const CONFIG_CSV_URL = `${SHEET_BASE}?gid=676041316&single=true&output=csv`;
// Production is reached through Cloudflare only; Render/Railway hosts are retired,
// so a stale build variable pointing at them falls back to the current API.
const DEFAULT_API_URL = "https://api.hwanhee1.com";
function rankedApiUrl(value) {
  try { const url = new URL(value); return /(?:^|\.)(?:onrender\.com|railway\.app)$/.test(url.hostname) ? DEFAULT_API_URL : url.origin + url.pathname.replace(/\/$/, ""); }
  catch (_) { return DEFAULT_API_URL; }
}
const RANKED_API_URL = rankedApiUrl(import.meta.env.VITE_RANKED_API_URL || DEFAULT_API_URL);
const API = `${RANKED_API_URL}/api/ranked`;
const THEME_STORAGE_KEY = "corum-ranked-theme";
const THEME_COLORS = { dark: "#0a0b0e", light: "#eef0f3" };
const SURVIVAL_PAGE = 50;

function getInitialTheme() {
  const current = document.documentElement.dataset.theme; if (current === "light" || current === "dark") return current;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]); try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (_) {} }, [theme]);
  return { theme, toggleTheme: () => setTheme((value) => value === "dark" ? "light" : "dark") };
}
function useRemoteData(loader, enabled = true) {
  const [state, setState] = useState({ data: null, loading: enabled, error: "" }); const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController(); setState((current) => ({ ...current, loading: true, error: "" }));
    loader(controller.signal).then((data) => { if (!controller.signal.aborted) setState({ data, loading: false, error: "" }); }).catch((reason) => { if (!controller.signal.aborted) setState({ data: null, loading: false, error: reason instanceof Error ? reason.message : "데이터를 불러오지 못했습니다." }); });
    return () => controller.abort();
  }, [reloadKey, enabled]);
  return { ...state, reload: () => setReloadKey((value) => value + 1) };
}
function requestError(error, label) {
  if (error?.name === "TimeoutError") return `${label} 응답 대기 시간이 초과되었습니다.`;
  if (/요청 실패/.test(error?.message || "")) return `${label} ${error.message}`;
  // A browser reports a blocked cross-origin read (CORS) or an offline host the same way.
  return `${label}에 연결하지 못했습니다.`;
}
async function loadLeaderboard(url, signal) {
  try { return normalizeLeaderboard(await fetchJson(url, signal)); }
  catch (error) { if (signal.aborted) throw error; throw new Error(requestError(error, "Ranked 서버")); }
}

function useRankedConfig() {
  return useRemoteData(async (signal) => normalizeRankedConfig(await fetchJson(`${API}/config`, signal)));
}
function useSoloLeaderboard() {
  const remote = useRemoteData((signal) => loadLeaderboard(`${API}/leaderboard`, signal));
  return { ...remote, players: remote.data?.players || [] };
}
/** Survival is paged by the server (max 50); it loads the first time its tab is opened. */
function useSurvivalLeaderboard() {
  const [active, setActive] = useState(false);
  const remote = useRemoteData((signal) => loadLeaderboard(`${API}/survival/leaderboard?offset=0&limit=${SURVIVAL_PAGE}`, signal), active);
  const [extra, setExtra] = useState({ players: [], hasMore: null, loadingMore: false });
  const pending = useRef(null);
  useEffect(() => { pending.current?.abort(); setExtra({ players: [], hasMore: null, loadingMore: false }); }, [remote.data]);
  useEffect(() => () => pending.current?.abort(), []);
  const players = [...(remote.data?.players || []), ...extra.players];
  const hasMore = extra.hasMore ?? remote.data?.hasMore ?? false;
  const loadMore = useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setExtra((current) => ({ ...current, loadingMore: true }));
    try {
      const page = await loadLeaderboard(`${API}/survival/leaderboard?offset=${players.length}&limit=${SURVIVAL_PAGE}`, controller.signal);
      if (!controller.signal.aborted) setExtra((current) => {
        const seen = new Set([...(remote.data?.players || []), ...current.players].map((player) => player.id));
        return { players: [...current.players, ...page.players.filter((player) => !seen.has(player.id))], hasMore: page.hasMore, loadingMore: false };
      });
    } catch (_) {
      if (!controller.signal.aborted) setExtra((current) => ({ ...current, loadingMore: false }));
    } finally { if (pending.current === controller) pending.current = null; }
  }, [players.length, remote.data]);
  return { ...remote, loading: !active || remote.loading, players, hasMore, loadingMore: extra.loadingMore, loadMore, activate: () => setActive(true) };
}
function useRankedMaps() {
  const remote = useRemoteData((signal) => loadRankedMaps(`${API}/maps`, SHEET2_CSV_URL, signal));
  return { ...remote, maps: remote.data || [] };
}
function useTierGuide() {
  const remote = useRemoteData((signal) => loadTierGuide(`${API}/leaderboard/tiers`, TIER_CSV_URL, signal));
  return { ...remote, tiers: remote.data?.tiers || [], gold: remote.data?.gold || null, source: remote.data?.source || null };
}
/** Optional operator values (e.g. demotion penalty) from the published Ranked Config sheet. */
function useSheetConfig() {
  const remote = useRemoteData(async (signal) => {
    const config = {};
    csvObjects(await fetchText(CONFIG_CSV_URL, signal)).forEach((row) => { const key = row.Key || row.key || Object.values(row)[0]; const raw = row.Value ?? row.value ?? Object.values(row)[1]; if (key) config[key] = raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw; });
    return config;
  });
  return remote.data || {};
}

function ServerStatus({ config, solo }) {
  const fromConfig = config.data ? config.data.modes.solo.enabled || config.data.modes.survival.enabled : null;
  const open = fromConfig ?? (solo.data ? solo.data.serverOpen : null);
  const loading = open === null && (config.loading || solo.loading);
  const label = loading ? "서버 확인 중" : open === null ? "상태 확인 불가" : open ? "서버 열림" : "서버 닫힘";
  const detail = config.data ? `Solo ${config.data.modes.solo.enabled ? "열림" : "닫힘"} · Survival ${config.data.modes.survival.enabled ? "열림" : "닫힘"}` : label;
  return <div className={"server-status " + (open === true ? "is-open" : open === false ? "is-closed" : "is-unknown")} role="status" aria-live="polite" title={detail}><i aria-hidden="true" /><span>{label}</span></div>;
}

function tabFromHash() { if (window.location.hash === "#ranking") return "ranking"; if (window.location.hash === "#placement") return "placement"; if (window.location.hash === "#info" || window.location.hash === "#pools") return "info"; return "list"; }
const TABS = [{ id: "list", label: "맵 리스트", number: "01" }, { id: "ranking", label: "순위", number: "02" }, { id: "info", label: "정보", number: "03" }];

function App() {
  const [tab, setTab] = useState(tabFromHash);
  useStickyOffsets(tab);
  const { theme, toggleTheme } = useTheme();
  const rankedConfig = useRankedConfig();
  const rankedMaps = useRankedMaps();
  const solo = useSoloLeaderboard();
  const survival = useSurvivalLeaderboard();
  const tierGuide = useTierGuide();
  const sheetConfig = useSheetConfig();
  useEffect(() => {
    const syncTab = () => { setTab(tabFromHash()); window.scrollTo({ top: 0, behavior: "auto" }); };
    window.addEventListener("hashchange", syncTab);
    return () => window.removeEventListener("hashchange", syncTab);
  }, []);
  const changeTab = (value) => { setTab(value); history.replaceState(null, "", "#" + value); window.scrollTo({ top: 0, behavior: "auto" }); };
  return <div className="site-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById("main-content")?.focus(); }}>본문으로 건너뛰기</a>
    <header className="site-header-wrap"><div className="site-header">
      <button type="button" className="brand" onClick={() => changeTab("list")} aria-label="Corum Ranked 맵 리스트"><span className="brand-symbol" aria-hidden="true"><span>CR</span></span><span className="brand-wordmark"><strong>CORUM</strong><span>RANKED</span></span></button>
      <nav className="site-tabs" aria-label="사이트 메뉴">{TABS.map((item) => {
        const active = tab === item.id || (tab === "placement" && item.id === "info");
        return <button type="button" key={item.id} className={active ? "active" : ""} onClick={() => changeTab(item.id)} aria-current={active ? "page" : undefined}><span><span className="tab-number" aria-hidden="true">{item.number}</span>{item.label}</span></button>;
      })}</nav>
      <div className="header-actions">
        <ServerStatus config={rankedConfig} solo={solo} />
        <button type="button" className="header-button theme-button" onClick={toggleTheme} aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"} title={theme === "dark" ? "라이트 모드" : "다크 모드"}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
        <button type="button" className="header-button mod-button" aria-label="모드 다운로드 준비 중" disabled title="모드 다운로드 준비 중"><Icon name="download" /><span>모드<span className="soon-label">준비 중</span></span></button>
      </div>
    </div></header>
    <main id="main-content" className="content" tabIndex="-1">
      {tab === "list" && <MapList {...rankedMaps} />}
      {tab === "ranking" && <Ranking solo={solo} survival={survival} config={rankedConfig} />}
      {tab === "info" && <Information maps={rankedMaps.maps} mapsLoading={rankedMaps.loading} tierState={tierGuide} rankedConfig={rankedConfig} sheetConfig={sheetConfig} reloadTiers={() => { tierGuide.reload(); rankedConfig.reload(); }} onOpenPlacement={() => changeTab("placement")} />}
      {tab === "placement" && <PlacementInformation onBack={() => changeTab("info")} tiers={tierGuide.tiers} />}
    </main>
    <footer className="footer"><div><strong>CORUM RANKED</strong><span>맵 · 순위 · 규칙</span></div><span>PUBLIC DATA / RANKED API + SHEETS</span></footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
