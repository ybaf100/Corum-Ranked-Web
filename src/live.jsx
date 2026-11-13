import React, { useEffect, useRef, useState } from "react";
import { tierLabel } from "./ranked-data.js";
import { DifficultyBadge, TierBadge, formatClock } from "./ui.jsx";
import { TierArtwork } from "./artwork.jsx";
import { DEFAULT_RULES, placementDisplay } from "./ranked-data.js";

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

function SoloCard({ match, now, onOpen }) {
  const clock = remaining(match.deadlineAt, now);
  const stage = match.deathmatch ? `Death Match${match.deathmatch.sequence > 1 ? ` #${match.deathmatch.sequence}` : ""}` : match.round ? `Round ${match.round}` : "준비";
  return <article className="live-card live-solo" onClick={onOpen}>
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
    <button type="button" className="live-open" onClick={(event) => { event.stopPropagation(); onOpen(); }} aria-haspopup="dialog" aria-label={`${match.players[0].name} 대 ${match.players[1].name} 경기 자세히 보기`}><span>자세히</span></button>
  </article>;
}

function SurvivalCard({ match, now, onOpen }) {
  const clock = remaining(match.endsAt, now);
  return <article className="live-card live-survival" onClick={onOpen}>
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
    <button type="button" className="live-open" onClick={(event) => { event.stopPropagation(); onOpen(); }} aria-haspopup="dialog" aria-label={`Survival ${match.entrants}인 경기 자세히 보기`}><span>자세히</span></button>
  </article>;
}

// Matches carry no public ID: a Solo match is its pairing and start, a Survival match its start and field.
const soloKey = (match) => `solo:${match.players[0].name}:${match.players[1].name}:${match.startedAt}`;
const survivalKey = (match) => `survival:${match.startedAt}:${match.entrants}`;
const SURVIVAL_STEPS = { 16: [16, 10, 6, 3, 1], 64: [64, 40, 26, 12, 5, 1] };
const PHASE_INDEX = { ROUND_1: 1, ROUND_2: 2, ROUND_3: 3, ROUND_4: 4, FINAL: 99, TIEBREAK: 99 };
const SOLO_CLOCK_LABEL = { BAN_PHASE: "밴 마감까지", ROUND_PLAYING: "메인 시간", FINAL_ATTEMPT_WINDOW: "마지막 시작 마감까지", LAST_ATTEMPT_WINDOW: "LAST ATTEMPT 마감까지", DEATHMATCH_PLAYING: "Death Match 마감까지" };

function elapsed(since, now) {
  if (!since) return null;
  const minutes = Math.floor((now - new Date(since).getTime()) / 60_000);
  if (minutes < 1) return "방금 시작";
  return minutes < 60 ? `${minutes}분 전 시작` : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 전 시작`;
}
function winRate(player) { const total = player.wins + player.losses; return total ? Math.round(player.wins / total * 1000) / 10 : 0; }

function SoloSide({ player, standing, wins, side }) {
  const base = (standing?.baseTier || (player.tier ? player.tier.replace(/[123]$/, "") : "UNRANKED")).replace(/^(MASTER|CHAMPION)$/, "GOLD");
  return <div className={"live-detail-side" + (side ? " is-right" : "")}>
    <TierArtwork tier={base} variant="badge" />
    <strong>{player.name}{player.isBot && <span className="bot-label">BOT</span>}</strong>
    {player.tier && <TierBadge tier={standing?.tier || player.tier} />}
    {standing ? <dl>
      {standing.visibleRankedScore !== null && <div><dt>LP</dt><dd>{standing.visibleRankedScore.toLocaleString()}</dd></div>}
      {standing.rank && <div><dt>순위</dt><dd>{standing.rank}위</dd></div>}
      <div><dt>전적</dt><dd>{standing.wins}승 {standing.losses}패 · {winRate(standing)}%</dd></div>
      {standing.promotion && <div><dt>승급전</dt><dd>{tierLabel(standing.promotion.targetTier)} · {standing.promotion.results.filter((r) => r === "WIN").length}/{standing.promotion.winsRequired}승</dd></div>}
      {standing.demotionWarning && <div><dt>상태</dt><dd className="is-warning">강등 경고</dd></div>}
      {standing.visibleRankedScore === null && <div><dt>배치</dt><dd>{placementDisplay(standing.placement).title}</dd></div>}
    </dl> : <p className="live-detail-muted">{player.isBot ? "봇 플레이어" : "순위표 정보 없음"}</p>}
    <b className="live-detail-wins" aria-label={`라운드 ${wins}승`}>{wins}</b>
  </div>;
}

function SoloDetail({ match, now, players, rules }) {
  const find = (name) => players.find((player) => player.player === name) || null;
  const rounds = match.format === "SINGLE" ? 1 : 3;
  const current = match.deathmatch ? rounds + 1 : match.round || 0;
  const clock = remaining(match.deadlineAt, now);
  const scores = match.roundScore?.scores || [null, null];
  const total = (scores[0] || 0) + (scores[1] || 0);
  return <>
    <div className="live-detail-versus">
      {match.players.map((player, side) => <SoloSide key={side} side={side} player={player} standing={find(player.name)} wins={match.roundWins[side]} />)}
      <span className="live-detail-vs" aria-hidden="true">VS</span>
    </div>
    <ol className="live-detail-rounds" aria-label="라운드 진행">
      {Array.from({ length: rounds }, (_, i) => <li key={i} className={i + 1 < current ? "is-done" : i + 1 === current ? "is-current" : ""}><span>R{i + 1}</span><b>{i + 1 < current ? "완료" : i + 1 === current ? "진행 중" : match.format === "BO3" && i === 2 ? "동률 시" : "대기"}</b></li>)}
      <li className={match.deathmatch ? "is-current" : ""}><span>DM</span><b>{match.deathmatch ? `진행 중${match.deathmatch.sequence > 1 ? ` #${match.deathmatch.sequence}` : ""}` : "무승부 시"}</b></li>
    </ol>
    <section className="live-detail-block" aria-label="현재 라운드">
      <header><span>{match.deathmatch ? "DEATH MATCH" : match.round ? `ROUND ${match.round}` : "준비"}</span><b>{SOLO_STATES[match.state] || match.state}</b></header>
      {(match.map || match.deathmatch?.map) && <div className="live-detail-map">
        <strong>{match.map?.title || match.deathmatch.map}</strong>
        {match.map?.difficulty && <DifficultyBadge value={match.map.difficulty} />}
        {match.map?.pool && <span>POOL {match.map.pool}</span>}
      </div>}
      {clock && <p className="live-detail-clock"><span>{SOLO_CLOCK_LABEL[match.state] || "남은 시간"}</span><b>{clock}</b></p>}
      {match.roundScore && <>
        <div className="live-detail-scorebar" aria-hidden="true"><i style={{ width: total ? `${(scores[0] || 0) / total * 100}%` : "50%" }} /></div>
        <div className="live-detail-scores">
          {[0, 1].map((side) => <div key={side} className={side ? "is-right" : ""}>
            <strong>{scoreText(scores[side])}<small>점</small></strong>
            <span>{match.roundScore.clears[side]} / {rules.clearTarget} Clear</span>
            <span className="live-clears" aria-hidden="true">{Array.from({ length: Math.max(rules.clearTarget, match.roundScore.clears[side]) }, (_, i) => <i key={i} className={i < match.roundScore.clears[side] ? "is-on" : ""} />)}</span>
          </div>)}
        </div>
      </>}
    </section>
    <dl className="live-detail-facts">
      <div><dt>형식</dt><dd>{match.format === "SINGLE" ? "단판" : "Best of 3"}</dd></div>
      <div><dt>Effective tier</dt><dd>{match.effectiveTier ? tierLabel(match.effectiveTier) : "—"}</dd></div>
      <div><dt>라운드 시간</dt><dd>{formatClock(rules.roundSeconds)} + {rules.finalAttemptWindowSeconds}초</dd></div>
      <div><dt>시작</dt><dd>{elapsed(match.startedAt, now) || "—"}</dd></div>
    </dl>
    {match.botMatch && <p className="live-detail-muted">디버그 봇과의 경기입니다. 순위·LP에는 반영 방식이 다를 수 있습니다.</p>}
  </>;
}

function SurvivalDetail({ match, now, survivalPlayers, playerCount }) {
  const steps = SURVIVAL_STEPS[playerCount === 64 || match.entrants > 16 ? 64 : 16];
  const index = match.phase === "FINAL" || match.phase === "TIEBREAK" ? steps.length - 1 : PHASE_INDEX[match.phase] || 0;
  const clock = remaining(match.endsAt, now);
  const eliminated = Math.max(0, match.entrants - match.alive);
  const find = (name) => survivalPlayers.find((player) => player.player === name) || null;
  return <>
    <div className="live-detail-survival-head">
      <div><span>현재</span><strong>{phaseLabel(match.phase)}</strong></div>
      <div><span>생존</span><strong>{match.alive}<small> / {match.entrants}</small></strong></div>
      <div><span>통과 목표</span><strong>{match.targetQualifiers ?? "—"}<small>명</small></strong></div>
      <div><span>남은 시간</span><strong>{clock || "—"}</strong></div>
    </div>
    <div className="live-detail-alive" aria-hidden="true"><i style={{ width: `${match.entrants ? match.alive / match.entrants * 100 : 0}%` }} /></div>
    <ol className="live-detail-bracket" aria-label="라운드별 통과 목표">
      {steps.map((value, i) => <li key={i} className={i < index ? "is-done" : i === index ? "is-current" : ""}><span>{i === 0 ? "START" : i === steps.length - 1 ? "FINAL" : `R${i}`}</span><b>{value}</b></li>)}
    </ol>
    {match.map && <section className="live-detail-block" aria-label="현재 맵"><header><span>MAP</span><b>{SURVIVAL_STATES[match.state] || match.state}</b></header><div className="live-detail-map"><strong>{match.map.title}</strong>{match.map.creator && <span>by {match.map.creator}</span>}</div></section>}
    <dl className="live-detail-facts">
      <div><dt>탈락</dt><dd>{eliminated}명</dd></div>
      <div><dt>참가</dt><dd>사람 {match.humans} · 봇 {Math.max(0, match.entrants - match.humans)}</dd></div>
      <div><dt>종류</dt><dd>{match.kind === "DEBUG" ? "디버그 경기" : "공식 경기"}</dd></div>
      <div><dt>시작</dt><dd>{elapsed(match.startedAt, now) || "—"}</dd></div>
    </dl>
    <section className="live-detail-block" aria-label="생존 중인 플레이어">
      <header><span>생존 중인 플레이어</span><b>{match.aliveHumans.length}명</b></header>
      {match.aliveHumans.length ? <ul className="live-detail-people">{match.aliveHumans.map((name) => { const standing = find(name); return <li key={name}><strong>{name}</strong>{standing ? <span><TierBadge tier={standing.tier} /> {standing.visibleRankedScore?.toLocaleString()} LP · {standing.rank}위</span> : null}</li>; })}</ul>
        : <p className="live-detail-muted">살아남은 사람 플레이어가 없습니다.</p>}
      <p className="live-detail-muted">진행 중 순위와 진행률은 경기가 끝난 뒤 공개됩니다.</p>
    </section>
  </>;
}

/** Native dialog: focus is trapped, Esc closes and focus returns to the card. */
function LiveMatchDialog({ selection, data, now, players, survivalPlayers, rules, playerCount, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (selection && !dialog.open) dialog.showModal();
    if (!selection && dialog.open) dialog.close();
    return undefined;
  }, [selection]);
  const match = selection && data ? (selection.type === "solo" ? data.solo.matches.find((m) => soloKey(m) === selection.key) : data.survival.matches.find((m) => survivalKey(m) === selection.key)) : null;
  const shown = match || selection?.last || null;
  const finished = selection && !match;
  return <dialog ref={ref} className="live-dialog" aria-labelledby="live-dialog-title" onClose={onClose} onClick={(event) => { if (event.target === ref.current) onClose(); }}>
    {shown && <div className="live-dialog-body">
      <header className="live-dialog-head">
        <div>
          <p className="section-kicker"><span className="live-dot" aria-hidden="true" /> {finished ? "경기 종료" : "LIVE"}</p>
          <h2 id="live-dialog-title">{selection.type === "solo" ? `${shown.players[0].name} vs ${shown.players[1].name}` : `Survival ${shown.entrants}인`}</h2>
        </div>
        <button type="button" className="live-dialog-close" onClick={onClose} aria-label="닫기"><span aria-hidden="true">×</span></button>
      </header>
      {finished && <p className="live-detail-ended">이 경기는 끝났거나 더 이상 LIVE 목록에 없습니다. 결과는 순위표에 반영됩니다.</p>}
      {selection.type === "solo" ? <SoloDetail match={shown} now={now} players={players} rules={rules} /> : <SurvivalDetail match={shown} now={now} survivalPlayers={survivalPlayers} playerCount={playerCount} />}
      <p className="live-detail-muted">자동으로 갱신되며, 라운드 전환 같은 변화는 바로 반영됩니다.</p>
    </div>}
  </dialog>;
}

/** LIVE board on the standings tab; hidden entirely when the server has no live API. */
export function LiveBoard({ live, players = [], survival, rules = DEFAULT_RULES, playerCount = null }) {
  const data = live.data;
  const [selection, setSelection] = useState(null);
  const matches = data ? data.solo.matches.length + data.survival.matches.length : 0;
  const now = useNow(matches > 0 || selection !== null);
  // Keep the latest copy so a match that just ended stays readable in the open dialog.
  useEffect(() => {
    if (!selection || !data) return;
    const match = selection.type === "solo" ? data.solo.matches.find((m) => soloKey(m) === selection.key) : data.survival.matches.find((m) => survivalKey(m) === selection.key);
    if (match && match !== selection.last) setSelection((current) => current && current.key === selection.key ? { ...current, last: match } : current);
  }, [data, selection]);
  const open = (type, match) => { setSelection({ type, key: type === "solo" ? soloKey(match) : survivalKey(match), last: match }); if (type === "survival") survival?.activate?.(); };
  if (!data) return live.loading ? <section className="live-board is-loading" aria-busy="true" aria-label="진행 중 경기 불러오는 중"><div className="live-heading"><h2><span className="live-dot" aria-hidden="true" />LIVE</h2></div></section> : null;
  return <section className="live-board" aria-labelledby="live-title">
    <div className="live-heading">
      <h2 id="live-title"><span className="live-dot" aria-hidden="true" />LIVE</h2>
      <p role="status">진행 중 <b>{matches}</b>경기 · 대기열 Solo <b>{data.solo.queued}</b>명 · Survival <b>{data.survival.queued}</b>명</p>
    </div>
    {matches ? <div className="live-grid">
      {data.solo.matches.map((match) => <SoloCard match={match} now={now} key={soloKey(match)} onOpen={() => open("solo", match)} />)}
      {data.survival.matches.map((match) => <SurvivalCard match={match} now={now} key={survivalKey(match)} onOpen={() => open("survival", match)} />)}
    </div> : <p className="live-empty">지금 진행 중인 경기가 없습니다. 새 경기가 시작되면 자동으로 나타납니다.</p>}
    <LiveMatchDialog selection={selection} data={data} now={now} players={players} survivalPlayers={survival?.players || []} rules={rules} playerCount={playerCount} onClose={() => setSelection(null)} />
  </section>;
}
