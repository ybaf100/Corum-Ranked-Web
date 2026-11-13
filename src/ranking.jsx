import React, { useMemo, useState } from "react";
import { TierArtwork } from "./artwork.jsx";
import { placementDisplay, tierLabel } from "./ranked-data.js";
import { PageHeading, SearchToolbar, StateCard, TierBadge, seasonText } from "./ui.jsx";
import { LiveBoard } from "./live.jsx";

function formatMarks(results, required) { const known = Number.isFinite(required) && required > 0; const length = known ? required : results.length; const marks = results.slice(0, length).map((result) => result === "WIN" ? "O" : "X"); return `${marks.join("")}${"-".repeat(Math.max(0, length - marks.length))}` || "—"; }
function formatWinRate(player) { const total = player.wins + player.losses; if (!total) return "0"; const rate = player.wins / total * 100; return Number.isInteger(rate) ? String(rate) : rate.toFixed(1); }
const formatLp = (value) => Number.isFinite(value) ? value.toLocaleString() : "—";

function PlayerName({ player, detail }) {
  return <div className="player-name">
    <strong>{player.player}{player.isBot && <span className="bot-label">BOT</span>}</strong>
    <span>{player.title || detail}</span>
  </div>;
}

function PlayerStatus({ player }) {
  if (player.tier === "UNRANKED" || player.visibleRankedScore === null) {
    const status = placementDisplay(player.placement);
    return <div className="player-status placement-player-status"><TierBadge tier="UNRANKED" /><strong className="placement-stage-label">{status.title}</strong><small>{status.detail}</small>{status.totalStages && <div className="placement-stage-progress" aria-label={`${status.completedStages} / ${status.totalStages} Stage 완료`}>{Array.from({ length: status.totalStages }, (_, index) => <span key={index} className={index < status.completedStages ? "is-complete" : index + 1 === status.currentStageIndex ? "is-current" : ""} aria-hidden="true">{index < status.completedStages ? "✓" : index + 1}</span>)}</div>}</div>;
  }
  if (player.promotion) {
    const marks = formatMarks(player.promotion.results, player.promotion.gamesRequired);
    return <div className="player-status"><TierBadge tier={player.tier} /><strong className="series-marks" aria-label={marks.split("").map((mark) => mark === "O" ? "승리" : mark === "X" ? "패배" : "미진행").join(", ")}>{marks.split("").map((mark, index) => <span key={index} className={mark === "O" ? "series-win" : mark === "X" ? "series-loss" : "series-pending"} aria-hidden="true">{mark === "-" ? "–" : mark}</span>)}</strong><small>{tierLabel(player.promotion.targetTier)} 승급전 · {player.promotion.winsRequired}승 필요</small></div>;
  }
  return <div className="player-status"><TierBadge tier={player.tier} /><strong className="lp-value">{formatLp(player.visibleRankedScore)} <span>LP</span></strong>{player.demotionWarning && <small className="warning-label">강등 경고</small>}</div>;
}

function PlayerRecord({ player, survival = false }) {
  if (survival) {
    const matches = player.wins + player.losses;
    return <div className="record-line"><div className="record-numbers"><strong>{player.wins}<small>우승</small></strong><span>/</span><strong>{matches}<small>경기</small></strong>{player.winStreak > 1 && <b>{player.winStreak}<small>연속 우승</small></b>}</div><div className="win-rate-track" aria-hidden="true"><i style={{ width: (matches ? player.wins / matches * 100 : 0) + "%" }} /></div></div>;
  }
  return <div className="record-line"><div className="record-numbers"><strong>{player.wins}<small>승</small></strong><span>/</span><strong>{player.losses}<small>패</small></strong><b>{formatWinRate(player)}<small>%</small></b></div><div className="win-rate-track" aria-hidden="true"><i style={{ width: formatWinRate(player) + "%" }} /></div></div>;
}

function LeaderCards({ players }) {
  return <div className="leader-grid">{players.map((player, index) => {
    const rank = player.rank ?? index + 1;
    return <article className="leader-card" data-rank={rank} data-tier={player.baseTier.toLowerCase()} key={player.id} style={{ "--leader-index": index }}>
      <div className="leader-top">
        <div className="leader-rank"><strong>{String(rank).padStart(2, "0")}</strong><span>{rank === 1 ? "CURRENT NO.1" : rank === 2 ? "RUNNER-UP" : "THIRD"}</span></div>
        <TierArtwork tier={player.baseTier} variant="leader" />
      </div>
      <PlayerName player={player} detail="RANKED PLAYER" />
      <PlayerStatus player={player} />
      <PlayerRecord player={player} />
    </article>;
  })}</div>;
}

function RankingRows({ players, unranked = false, survival = false }) {
  return <div className="table-scroll ranking-scroll"><div className={"ranking-list" + (unranked ? " unranked-list" : "")}>
    <div className="ranking-head" aria-hidden="true"><span>{unranked ? "—" : "순위"}</span><span>플레이어</span><span>{unranked ? "PLACEMENT" : "티어 / 상태"}</span><span>{survival ? "우승 / 경기" : "전적 / 승률"}</span></div>
    {players.map((player, index) => {
      const rank = unranked ? null : player.rank ?? index + 1;
      return <article className={"ranking-row" + (unranked ? " unranked-row" : "")} data-rank={rank ?? undefined} data-tier={player.baseTier.toLowerCase()} key={player.id}>
        <strong className="rank-number">{rank === null ? "—" : String(rank).padStart(2, "0")}</strong>
        <div className="player-identity"><TierArtwork tier={player.baseTier} variant="badge" /><PlayerName player={player} detail={unranked ? placementDisplay(player.placement).progress : survival ? "SURVIVAL PLAYER" : "RANKED PLAYER"} /></div>
        <PlayerStatus player={player} /><PlayerRecord player={player} survival={survival} />
      </article>;
    })}
  </div></div>;
}

function useFiltered(players, query) {
  return useMemo(() => { const q = query.trim().toLocaleLowerCase(); return q ? players.filter((player) => player.player.toLocaleLowerCase().includes(q)) : players; }, [players, query]);
}

function SoloStandings({ board, query }) {
  const rankedPlayers = useMemo(() => board.players.filter((player) => player.tier !== "UNRANKED" && player.visibleRankedScore !== null), [board.players]);
  const unrankedPlayers = useMemo(() => board.players.filter((player) => player.tier === "UNRANKED" || player.visibleRankedScore === null), [board.players]);
  const rankedFiltered = useFiltered(rankedPlayers, query);
  const unrankedFiltered = useFiltered(unrankedPlayers, query);
  const leaders = !query.trim() && rankedPlayers.length >= 3 ? rankedPlayers.slice(0, 3) : [];
  const rest = leaders.length ? rankedFiltered.slice(3) : rankedFiltered;
  if (!rankedFiltered.length && !unrankedFiltered.length) return <StateCard title={board.players.length ? "검색 결과가 없습니다." : "표시할 플레이어가 없습니다."} description={board.players.length ? "플레이어 이름을 다시 확인하세요." : "공개 Ranked 플레이어가 등록되면 여기에 표시됩니다."} />;
  return <>
    {rankedFiltered.length > 0 && <>
      <div className="result-line"><span>RANKED <b>{rankedFiltered.length} PLAYERS</b></span><small>Hidden MMR 비공개 · 서버 순위 기준</small></div>
      {leaders.length > 0 && <LeaderCards players={leaders} />}
      {rest.length > 0 && <RankingRows players={rest} />}
    </>}
    {unrankedFiltered.length > 0 && <div className="unranked-section">
      <div className="unranked-heading"><div><p className="section-kicker">NEXT IN LINE</p><h2>Unranked</h2></div><span>{unrankedFiltered.length} PLAYERS</span></div>
      <RankingRows players={unrankedFiltered} unranked />
    </div>}
  </>;
}

function SurvivalStandings({ board, query }) {
  const filtered = useFiltered(board.players, query);
  if (!filtered.length) return <StateCard title={board.players.length ? "검색 결과가 없습니다." : "표시할 플레이어가 없습니다."} description={board.players.length ? (board.hasMore ? "불러온 순위 안에 없습니다. 아래에서 더 불러올 수 있습니다." : "플레이어 이름을 다시 확인하세요.") : "Survival 기록이 생기면 여기에 표시됩니다."} action={board.hasMore ? <button className="primary-button" type="button" onClick={board.loadMore} disabled={board.loadingMore}>순위 더 보기</button> : null} />;
  return <>
    <div className="result-line"><span>SURVIVAL <b>{board.totalPlayers} PLAYERS</b></span><small>Survival 전용 LP · 같은 LP는 먼저 도달한 순</small></div>
    <RankingRows players={filtered} survival />
    {board.hasMore && <button className="load-more-button" type="button" onClick={board.loadMore} disabled={board.loadingMore}>{board.loadingMore ? "불러오는 중…" : "순위 더 보기"}</button>}
  </>;
}

function modeStatus(loading, error, open) {
  if (loading) return { label: "확인 중", tone: "is-unknown" };
  if (error) return { label: "상태 확인 불가", tone: "is-unknown" };
  return open ? { label: "열림", tone: "is-open" } : { label: "닫힘", tone: "is-closed" };
}

export function Ranking({ solo, survival, config, live }) {
  const [mode, setMode] = useState("solo");
  const [query, setQuery] = useState("");
  const board = mode === "solo" ? solo : survival;
  const choose = (next) => { setMode(next); if (next === "survival") survival.activate(); };
  const modes = [
    { id: "solo", label: "Solo Ranked", detail: "1 : 1", open: config.data ? config.data.modes.solo.enabled : solo.data?.serverOpen, season: config.data?.seasons.solo },
    { id: "survival", label: "Survival", detail: config.data?.modes.survival.playerCount ? `${config.data.modes.survival.playerCount}인` : "배틀로얄", open: config.data ? config.data.modes.survival.enabled : survival.data?.serverOpen, season: config.data?.seasons.survival },
  ];
  const count = board.loading || board.error ? "—" : board.data?.totalPlayers ?? board.players.length;
  return <section className="tab-page ranking-page">
    <PageHeading number="02" label="PUBLIC STANDINGS" title="Leader" accent="board" description="티어, LP, 그리고 기록. 현재의 순위를 확인하세요." count={count} countLabel="PLAYERS" />
    <LiveBoard live={live} players={solo.players} survival={survival} rules={config.data?.rules} playerCount={config.data?.modes.survival.playerCount ?? null} />
    <div className="mode-switch" role="group" aria-label="순위 모드">
      {modes.map((item) => {
        const status = modeStatus(config.loading && !config.data, config.error && !config.data && item.open === undefined, item.open);
        return <button key={item.id} type="button" className={mode === item.id ? "selected" : ""} aria-pressed={mode === item.id} onClick={() => choose(item.id)}>
          <span className="mode-name"><strong>{item.label}</strong><small>{item.detail}</small></span>
          <span className="mode-meta"><span className={"mode-status " + status.tone}><i aria-hidden="true" />{status.label}</span>{item.season && <span>{seasonText(item.season, item.open !== false)}</span>}</span>
        </button>;
      })}
    </div>
    <SearchToolbar className="ranking-toolbar" label="플레이어 검색" placeholder="플레이어 이름 검색" query={query} onQuery={setQuery} onReload={board.reload} loading={board.loading} />
    {board.error ? <StateCard type="error" title="순위 정보를 불러오지 못했습니다." description={board.error + " · 잠시 후 다시 시도해 주세요."} action={<button className="primary-button" type="button" onClick={board.reload}>다시 시도</button>} />
      : board.loading ? <div className="ranking-list" aria-busy="true" aria-label="순위 불러오는 중">{Array.from({ length: 6 }, (_, index) => <div className="ranking-row ranking-skeleton" key={index}><i /><i /><i /><i /></div>)}</div>
      : mode === "solo" ? <SoloStandings board={board} query={query} /> : <SurvivalStandings board={board} query={query} />}
    <p className="data-footnote">{mode === "solo" ? "Ranked가 닫혀 있어도 공개 데이터 조회가 가능하면 순위를 표시합니다. 정렬은 서버의 공개 순위 기준을 따르며, GOLD 안의 CHAMPION·MASTER 칭호도 서버가 계산합니다." : "Survival LP와 순위는 Solo Ranked와 독립적입니다. 우승은 최종 1위로 끝난 경기 수입니다."}</p>
  </section>;
}
