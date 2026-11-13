import React, { useEffect, useState } from "react";
import { tierLabel } from "./ranked-data.js";
import { DifficultyBadge, TierBadge, formatClock } from "./ui.jsx";

const SOLO_STATES = {
  MATCHED: "매칭 완료", BAN_PHASE: "밴 진행", ROUND_PREPARE: "라운드 준비", ROUND_ENTERING: "입장 중",
  ROUND_PLAYING: "플레이 중", FINAL_ATTEMPT_WINDOW: "마지막 시작 구간", LAST_ATTEMPT_WINDOW: "LAST ATTEMPT",
  ROUND_SETTLING: "정산 중", ROUND_RESULT: "라운드 결과", DEATHMATCH_PREPARE: "Death Match 준비",
  DEATHMATCH_ENTERING: "Death Match 입장", DEATHMATCH_PLAYING: "Death Match", DEATHMATCH_RESULT: "Death Match 결과",
};
const SURVIVAL_STATES = { MAP_SELECTION: "맵 선택", PREPARING: "준비 중", ENTERING: "입장 중", COUNTDOWN: "카운트다운", PLAYING: "플레이 중", ROUND_RESULT: "라운드 결과" };
const phaseLabel = (phase) => phase === "FINAL" ? "결승" : phase === "TIEBREAK" ? "결승 Death Match" : /^ROUND_(\d)$/.test(phase || "") ? `Round ${phase.slice(6)}` : "대기";

function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
function remaining(deadline, now) {
  if (!deadline) return null;
  const seconds = Math.ceil((new Date(deadline).getTime() - now) / 1000);
  return seconds > 0 ? formatClock(seconds) : null;
}
const scoreText = (value) => value == null ? "—" : Math.floor(value).toLocaleString();

function SoloCard({ match, now }) {
  const clock = remaining(match.deadlineAt, now);
  const stage = match.deathmatch ? `Death Match${match.deathmatch.sequence > 1 ? ` #${match.deathmatch.sequence}` : ""}` : match.round ? `Round ${match.round}` : "준비";
  return <article className="live-card live-solo">
    <header className="live-card-head">
      <span className="live-tag"><i aria-hidden="true" />{SOLO_STATES[match.state] || match.state}</span>
      <span>{match.botMatch ? "BOT MATCH · " : ""}{match.effectiveTier ? tierLabel(match.effectiveTier) + " · " : ""}{match.format === "SINGLE" ? "단판" : "BO3"}</span>
    </header>
    <div className="live-versus">
      {match.players.map((player, index) => <div className={"live-side" + (index ? " is-right" : "")} key={index}>
        <strong>{player.name}{player.isBot && <span className="bot-label">BOT</span>}</strong>
        {player.tier && <TierBadge tier={player.tier} />}
      </div>)}
      <div className="live-wins" aria-label={`라운드 승수 ${match.roundWins[0]} 대 ${match.roundWins[1]}`}><b>{match.roundWins[0]}</b><span>:</span><b>{match.roundWins[1]}</b></div>
    </div>
    <div className="live-round">
      <div className="live-round-meta">
        <span>{stage}</span>
        {(match.map || match.deathmatch?.map) && <strong>{match.map?.title || match.deathmatch.map}</strong>}
        {match.map?.difficulty && <DifficultyBadge value={match.map.difficulty} />}
      </div>
      {clock && <span className="live-clock" aria-label={`남은 시간 ${clock}`}>{clock}</span>}
    </div>
    {match.roundScore && <div className="live-score" aria-label="현재 라운드 점수와 Clear">
      {[0, 1].map((side) => <div key={side} className={side ? "is-right" : ""}>
        <strong>{scoreText(match.roundScore.scores[side])}</strong>
        <span className="live-clears" aria-label={`${match.roundScore.clears[side]} Clear`}>{Array.from({ length: Math.max(3, match.roundScore.clears[side]) }, (_, i) => <i key={i} className={i < match.roundScore.clears[side] ? "is-on" : ""} aria-hidden="true" />)}</span>
      </div>)}
    </div>}
  </article>;
}

function SurvivalCard({ match, now }) {
  const clock = remaining(match.endsAt, now);
  return <article className="live-card live-survival">
    <header className="live-card-head">
      <span className="live-tag"><i aria-hidden="true" />{SURVIVAL_STATES[match.state] || match.state}</span>
      <span>{match.kind === "DEBUG" ? "DEBUG · " : ""}SURVIVAL · {match.entrants}인</span>
    </header>
    <div className="live-survival-main">
      <div><span>{phaseLabel(match.phase)}</span><strong>{match.alive}<small> / {match.entrants} 생존</small></strong></div>
      {match.targetQualifiers != null && <div><span>통과 목표</span><strong>{match.targetQualifiers}<small>명</small></strong></div>}
      {clock && <span className="live-clock" aria-label={`남은 시간 ${clock}`}>{clock}</span>}
    </div>
    {match.map && <p className="live-map"><strong>{match.map.title}</strong>{match.map.creator && <span> by {match.map.creator}</span>}</p>}
    {match.aliveHumans.length > 0 && <p className="live-names"><span>생존 중</span>{match.aliveHumans.join(" · ")}</p>}
  </article>;
}

/** LIVE board on the standings tab; hidden entirely when the server has no live API. */
export function LiveBoard({ live }) {
  const data = live.data;
  const matches = data ? data.solo.matches.length + data.survival.matches.length : 0;
  const now = useNow(matches > 0);
  if (!data) return live.loading ? <section className="live-board is-loading" aria-busy="true" aria-label="진행 중 경기 불러오는 중"><div className="live-heading"><h2><span className="live-dot" aria-hidden="true" />LIVE</h2></div></section> : null;
  return <section className="live-board" aria-labelledby="live-title">
    <div className="live-heading">
      <h2 id="live-title"><span className="live-dot" aria-hidden="true" />LIVE</h2>
      <p role="status">진행 중 <b>{matches}</b>경기 · 대기열 Solo <b>{data.solo.queued}</b>명 · Survival <b>{data.survival.queued}</b>명</p>
    </div>
    {matches ? <div className="live-grid">
      {data.solo.matches.map((match, index) => <SoloCard match={match} now={now} key={`s${index}-${match.players[0].name}`} />)}
      {data.survival.matches.map((match, index) => <SurvivalCard match={match} now={now} key={`v${index}-${match.startedAt}`} />)}
    </div> : <p className="live-empty">지금 진행 중인 경기가 없습니다. 10초마다 자동으로 갱신됩니다.</p>}
  </section>;
}
