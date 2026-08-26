import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const SHEET2_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRzHKOAa1pnP8TCB3d22TZwM5G3BgQSZhiFloApWA6mMptX6PdU_q6bKj8fs9IhpujO9WZ8Cln7e6vW/pub?gid=1963044442&single=true&output=csv";
const THEME_STORAGE_KEY = "corum-ranked-theme";
const POOLS = [1, 2, 3, 4, 5, 6];

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
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (name === "sun") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" {...common} /><path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" {...common} /></svg>;
  }
  if (name === "moon") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.4A8 8 0 0 1 8.6 4a7.7 7.7 0 1 0 11.4 11.4Z" {...common} /></svg>;
  }
  if (name === "download") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14" {...common} /></svg>;
  }
  if (name === "refresh") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6" {...common} /></svg>;
  }
  if (name === "grid") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" {...common} /><rect x="14" y="3" width="7" height="7" rx="1" {...common} /><rect x="3" y="14" width="7" height="7" rx="1" {...common} /><rect x="14" y="14" width="7" height="7" rx="1" {...common} /></svg>;
  }
  if (name === "list") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...common} /></svg>;
  }
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

    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseRankedMaps(csv) {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const column = (name) => headers.indexOf(name);
  const titleColumn = column("맵 제목");
  const difficultyColumn = column("Rating");
  const mapCodeColumn = column("대체 맵 코드");
  const poolColumn = column("Ranked Pool (1~6)");
  const qualifyingColumn = column("Qualifying %");

  if ([titleColumn, difficultyColumn, mapCodeColumn, poolColumn, qualifyingColumn].some((index) => index < 0)) {
    throw new Error("sheet2의 필수 열 이름을 찾을 수 없습니다.");
  }

  return rows.slice(1).flatMap((values) => {
    const title = String(values[titleColumn] || "").trim();
    const difficulty = String(values[difficultyColumn] || "").trim();
    const mapCode = String(values[mapCodeColumn] || "").trim();
    const poolValue = Number(String(values[poolColumn] || "").trim());
    const pool = Number.isInteger(poolValue) && poolValue >= 1 && poolValue <= 6 ? poolValue : null;
    const qualifyingPercent = String(values[qualifyingColumn] || "").trim().replace(/%$/, "");
    if (!title || !difficulty || !mapCode) return [];
    return [{ title, difficulty, mapCode, pool, qualifyingPercent }];
  });
}

function difficultyIndex(value) {
  const normalized = /^20(?:\.0+)?$/.test(value) ? "20.0" : value;
  return DIFFICULTY_ORDER.indexOf(normalized);
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

function useRankedMaps() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${SHEET2_CSV_URL}&v=${Date.now()}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(`sheet2 요청 실패 (${response.status})`);
        setMaps(parseRankedMaps(await response.text()));
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "맵 정보를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [reloadKey]);

  return { maps, loading, error, reload: () => setReloadKey((value) => value + 1) };
}

function DifficultyBadge({ value }) {
  return <span className="difficulty-badge" style={{ background: DIFFICULTY_COLORS[value] || "#e8eaed", color: difficultyTextColor(value) }}>{value}</span>;
}

function StateCard({ type, title, description, action }) {
  return <div className={`state-card ${type === "error" ? "error-state" : ""}`} role={type === "error" ? "alert" : undefined}>
    <span>{type === "error" ? "LOAD FAILED" : "NO RANKED MAPS"}</span>
    <h2>{title}</h2>
    <p>{description}</p>
    {action}
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
    }).sort((left, right) => {
      if (left.pool !== right.pool) return left.pool - right.pool;
      return difficultyIndex(right.difficulty) - difficultyIndex(left.difficulty) || left.title.localeCompare(right.title, "ko");
    });
  }, [assignedMaps, poolFilter, query]);

  return <section className="tab-page">
    <div className="page-heading">
      <div>
        <p className="section-kicker">SHEET2 / LIVE MAP DATA</p>
        <h1>Ranked Map Pool</h1>
        <p>현재 Ranked에 배정된 맵과 경기 진입 기준을 확인합니다.</p>
      </div>
      <div className="total-counter"><span>ACTIVE MAPS</span><strong>{loading ? "—" : assignedMaps.length}</strong></div>
    </div>

    <div className="list-toolbar">
      <label className="search-shell">
        <Icon name="search" />
        <span className="sr-only">맵 검색</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="맵 제목 또는 맵 코드 검색" />
      </label>
      <select className="pool-select" value={poolFilter} onChange={(event) => setPoolFilter(event.target.value)} aria-label="Ranked Pool 필터">
        <option value="all">전체 Pool</option>
        {POOLS.map((pool) => <option value={pool} key={pool}>Pool {pool}</option>)}
      </select>
      <button className="reload-button" type="button" onClick={reload} disabled={loading}><Icon name="refresh" />새로고침</button>
    </div>

    {error ? <StateCard type="error" title="sheet2를 불러오지 못했습니다." description={error} action={<button className="primary-button" onClick={reload}>다시 시도</button>} />
      : loading ? <div className="map-list" aria-busy="true">{Array.from({ length: 7 }, (_, index) => <div className="map-row skeleton-row" key={index}><i /><i /><i /><i /><i /></div>)}</div>
      : filteredMaps.length ? <>
        <div className="result-line"><span>{filteredMaps.length} MAPS</span>{unassignedCount > 0 && <small>Pool 미배정 {unassignedCount}개는 목록에서 제외됨</small>}</div>
        <div className="map-list">
          <div className="map-list-head" aria-hidden="true"><span>POOL</span><span>MAP</span><span>DIFFICULTY</span><span>MAP CODE</span><span>QUALIFYING</span></div>
          {filteredMaps.map((map) => <article className={`map-row pool-${map.pool}`} key={`${map.mapCode}-${map.title}`}>
            <div className="pool-mark"><span>POOL</span><strong>{map.pool}</strong></div>
            <div className="map-title"><h2>{map.title}</h2><span>RANKED MAP</span></div>
            <DifficultyBadge value={map.difficulty} />
            <div className="map-code"><span>맵 코드</span><strong>{map.mapCode}</strong></div>
            <div className="qualifying"><span>QUALIFYING</span><strong>{map.qualifyingPercent ? `${map.qualifyingPercent}%` : "—"}</strong></div>
          </article>)}
        </div>
      </> : <StateCard title={assignedMaps.length ? "검색 결과가 없습니다." : "배정된 맵이 없습니다."} description={assignedMaps.length ? "검색어나 Pool 필터를 변경해 보세요." : "sheet2의 Ranked Pool (1~6) 열에 Pool 값을 입력하면 여기에 표시됩니다."} />}
  </section>;
}

function PoolComposition({ maps, loading }) {
  const poolCounts = useMemo(() => POOLS.map((pool) => maps.filter((map) => map.pool === pool).length), [maps]);
  return <section className="tab-page">
    <div className="page-heading composition-heading"><div><p className="section-kicker">MATCH MAP DISTRIBUTION</p><h1>티어별 풀 구성</h1><p>각 티어의 밴픽 후보 5개가 어느 Pool에서 나오는지 보여줍니다.</p></div></div>
    <div className="pool-count-strip">{POOLS.map((pool, index) => <div className={`pool-count pool-${pool}`} key={pool}><span>POOL {pool}</span><strong>{loading ? "—" : poolCounts[index]}</strong><small>등록 맵</small></div>)}</div>
    <div className="composition-table-shell">
      <div className="composition-title-line"><div><p className="section-kicker">5 MAP CANDIDATES</p><h2>티어별 등장 개수</h2></div><span>합계 5개</span></div>
      <div className="table-scroll"><table><thead><tr><th>티어</th>{POOLS.map((pool) => <th key={pool}>Pool {pool}</th>)}<th>합계</th></tr></thead><tbody>
        {TIER_POOL_DISTRIBUTION.map(({ tier, counts }) => <tr key={tier}><td><span className={`tier-badge tier-${tier.toLowerCase()}`}>{tier}</span></td>{counts.map((count, index) => <td key={`${tier}-${index}`}><span className={`distribution-value${count ? " is-active" : ""}`}>{count || "—"}</span></td>)}<td><strong className="distribution-total">5</strong></td></tr>)}
      </tbody></table></div>
    </div>
  </section>;
}

function App() {
  const initialTab = window.location.hash === "#pools" ? "pools" : "list";
  const [tab, setTab] = useState(initialTab);
  const { theme, toggleTheme } = useTheme();
  const rankedMaps = useRankedMaps();

  const changeTab = (value) => {
    setTab(value);
    history.replaceState(null, "", value === "pools" ? "#pools" : "#list");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return <div className="site-shell">
    <div className="spectrum-line" />
    <header className="site-header-wrap"><div className="site-header">
      <div className="brand"><span>CORUM</span><strong>RANKED</strong></div>
      <div className="header-actions">
        <nav className="site-tabs" aria-label="사이트 메뉴">
          <button className={tab === "list" ? "active" : ""} onClick={() => changeTab("list")}><Icon name="list" />맵 리스트</button>
          <button className={tab === "pools" ? "active" : ""} onClick={() => changeTab("pools")}><Icon name="grid" />풀 구성</button>
        </nav>
        <button className="header-button" onClick={toggleTheme} aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}><Icon name={theme === "dark" ? "sun" : "moon"} /><span>{theme === "dark" ? "LIGHT" : "DARK"}</span></button>
        <button className="header-button mod-button" disabled title="모드 다운로드 준비 중"><Icon name="download" /><span>모드</span></button>
      </div>
    </div></header>
    <main className="content">{tab === "list" ? <MapList {...rankedMaps} /> : <PoolComposition maps={rankedMaps.maps} loading={rankedMaps.loading} />}</main>
    <footer className="footer"><div><strong>CORUM RANKED</strong><span>Official Ranked map pool</span></div><span>DATA · SHEET2</span></footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
