import React, { useMemo, useState } from "react";
import { CopyMapCode } from "./copy-map-code.jsx";
import { DifficultyBadge, Icon, PageHeading, SearchToolbar, StateCard, difficultyIndex } from "./ui.jsx";

export const POOLS = [1, 2, 3, 4, 5, 6];

export function MapList({ maps, loading, error, reload }) {
  const [query, setQuery] = useState("");
  const [poolFilter, setPoolFilter] = useState("all");
  const assignedMaps = useMemo(() => maps.filter((map) => map.pool !== null), [maps]);
  const unassignedCount = maps.length - assignedMaps.length;
  const filteredMaps = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return assignedMaps.filter((map) => (!q || map.title.toLocaleLowerCase().includes(q) || map.mapCode.toLocaleLowerCase().includes(q)) && (poolFilter === "all" || map.pool === Number(poolFilter)))
      .sort((a, b) => a.pool - b.pool || difficultyIndex(a.difficulty) - difficultyIndex(b.difficulty) || a.title.localeCompare(b.title, "ko"));
  }, [assignedMaps, poolFilter, query]);
  const unknown = loading || error;
  return <section className="tab-page maps-page">
    <PageHeading number="01" label="COMPETITIVE MAPS" title="Map" accent="index" description="맵을 고르고, 다음 도전을 준비하세요." count={unknown ? "—" : assignedMaps.length} countLabel="ACTIVE MAPS" />
    <aside className="pool-directory" aria-label="Ranked Pool 필터">
      <div className="directory-heading"><span>POOL DIRECTORY</span><span>01—06</span></div>
      <div className="pool-filters">
        <button type="button" className={poolFilter === "all" ? "selected" : ""} onClick={() => setPoolFilter("all")} aria-pressed={poolFilter === "all"}><span><span>전체 맵</span><b>{unknown ? "—" : assignedMaps.length}</b></span></button>
        {POOLS.map((pool) => <button type="button" key={pool} data-pool={pool} className={poolFilter === String(pool) ? "selected" : ""} onClick={() => setPoolFilter(String(pool))} aria-pressed={poolFilter === String(pool)}><span><span>Pool {pool}</span><b>{unknown ? "—" : assignedMaps.filter((map) => map.pool === pool).length}</b></span></button>)}
      </div>
      <p className="directory-note"><Icon name="info" /><span><strong>Qualifying %</strong> 해당 진행률부터 Attempt 점수가 인정됩니다.</span></p>
    </aside>
    <div className="map-results">
      <SearchToolbar label="맵 검색" placeholder="맵 제목 또는 맵 코드 검색" query={query} onQuery={setQuery} onReload={reload} loading={loading} />
      {error ? <StateCard type="error" title="맵 목록을 불러오지 못했습니다." description={error} action={<button className="primary-button" type="button" onClick={reload}>다시 시도</button>} />
        : loading ? <div className="map-list" aria-busy="true" aria-label="맵 목록 불러오는 중">{Array.from({ length: 7 }, (_, index) => <div className="map-row skeleton-row" key={index}><i /><i /><i /><i /><i /></div>)}</div>
        : <>
          <div className="result-line" role="status"><span>{poolFilter === "all" ? "ALL POOLS" : "POOL " + poolFilter} <b>{filteredMaps.length} MAPS</b></span>{unassignedCount > 0 && <small>Pool 미배정 {unassignedCount}개 제외</small>}</div>
          {filteredMaps.length ? <div className="map-list">
            <div className="map-list-head" aria-hidden="true"><span>POOL</span><span>맵 제목</span><span>난이도</span><span>맵 코드</span><span>QUALIFYING</span></div>
            {filteredMaps.map((map, index) => <article className="map-row" data-pool={map.pool} key={map.mapCode + "-" + map.title} style={{ "--row-index": Math.min(index, 12) }}>
              <div className="pool-mark"><span>POOL</span><strong>{String(map.pool).padStart(2, "0")}</strong></div>
              <div className="map-title"><h2>{map.title}</h2></div>
              <div className="map-difficulty"><span className="mobile-field-label">난이도</span><DifficultyBadge value={map.difficulty} /></div>
              <CopyMapCode code={map.mapCode} />
              <div className="qualifying"><span>QUALIFYING</span><strong>{map.qualifyingPercent !== "" ? map.qualifyingPercent + "%" : "—"}</strong><div className="qualifying-track" aria-hidden="true"><i style={{ width: Math.min(100, Math.max(0, Number(map.qualifyingPercent) || 0)) + "%" }} /></div></div>
            </article>)}
          </div> : <StateCard title={assignedMaps.length ? "검색 결과가 없습니다." : "배정된 맵이 없습니다."} description={assignedMaps.length ? "검색어나 Pool 필터를 변경해 보세요." : "Ranked Pool에 등록된 맵이 여기에 표시됩니다."} />}
        </>}
    </div>
  </section>;
}
