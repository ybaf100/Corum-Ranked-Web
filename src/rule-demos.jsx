import React, { useLayoutEffect, useRef, useState } from "react";
import { createDemoTimeline } from "./demo-timeline.js";
import { SCORE_EXAMPLE, DEATHMATCH_EXAMPLE, STAGE_EXAMPLE, attemptExampleScore, stageExampleResult } from "./demo-rules.js";
import "./rule-demos.css";

function useDemoPlayback(steps, duration) {
  const ref = useRef(null);
  const clock = useRef(null);
  // Static, complete output is also the fallback for unsupported environments.
  const [phase, setPhase] = useState(steps - 1);
  const [state, setState] = useState("static");
  const [reduced, setReduced] = useState(true);
  useLayoutEffect(() => {
    if (!("IntersectionObserver" in window) || !("requestAnimationFrame" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timeline = createDemoTimeline({ steps, duration, onFrame: setPhase, onState: setState,
      requestFrame: callback => window.requestAnimationFrame(callback), cancelFrame: id => window.cancelAnimationFrame(id) });
    clock.current = timeline;
    const applyPreference = () => { setReduced(preference.matches); timeline.setReduced(preference.matches); };
    const applyVisibility = () => timeline.setPageVisible(document.visibilityState !== "hidden");
    applyPreference();
    applyVisibility();
    const observer = new IntersectionObserver(entries => {
      timeline.setVisible(entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.15));
    }, { threshold: [0, 0.15], rootMargin: "0px 0px -24px 0px" });
    if (ref.current) observer.observe(ref.current);
    preference.addEventListener("change", applyPreference);
    document.addEventListener("visibilitychange", applyVisibility);
    return () => {
      timeline.dispose();
      observer.disconnect();
      preference.removeEventListener("change", applyPreference);
      document.removeEventListener("visibilitychange", applyVisibility);
      clock.current = null;
    };
  }, [steps, duration]);
  return { ref, phase, state, reduced, replay: () => clock.current?.replay() };
}

function Check({ complete, active = false }) {
  return <span className={`demo-check${complete ? " is-checked" : ""}${active ? " is-active" : ""}`}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </span>;
}
function ReplayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1.5 7M4 4v6h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Demo({ playback, title, description, className = "", children }) {
  return <figure ref={playback.ref} className={`rule-demo ${className}`} data-playback={playback.state} aria-label={`${title}. ${description}`}>
    <figcaption className="demo-heading"><span>진행 예시 <b>{title}</b></span><button type="button" className="demo-replay" onClick={playback.replay} disabled={playback.reduced} aria-label={`${title} 다시 보기`} title={playback.reduced ? "정적인 진행 예시를 표시합니다" : "처음부터 다시 보기"}><ReplayIcon /><span>다시 보기</span></button></figcaption>
    <div className="demo-scene" aria-hidden="true">{children}</div>
    <p className="demo-description">{description}</p>
  </figure>;
}

export function StageRunDemo({ stages = 3, compact = false }) {
  const maps = stages * 2;
  const playback = useDemoPlayback(maps + 1, (maps + 1) * 360);
  const completed = Math.min(maps, playback.phase);
  return <Demo playback={playback} title={`${stages} Stage · ${maps} Map`} description="체크는 각 Map의 완료를 뜻합니다." className={`stage-run-demo${compact ? " compact-demo" : ""}`}>
    <div className="demo-stages" style={{ "--stage-count": stages }}>{Array.from({ length: stages }, (_, index) => {
      const done = completed >= (index + 1) * 2;
      const current = !done && Math.floor(completed / 2) === index;
      return <div className={`demo-stage${done ? " is-stage-complete" : ""}${current ? " is-stage-current" : ""}`} key={index}>
        <span className="demo-stage-number">{String(index + 1).padStart(2, "0")}</span>
        <div className="demo-stage-maps">{[0, 1].map(map => <Check key={map} complete={completed > index * 2 + map} active={completed === index * 2 + map} />)}</div>
        {index < stages - 1 && <span className="demo-stage-link"><i /></span>}
      </div>;
    })}</div>
    <div className="demo-bottom-line"><span>MAP 1 + MAP 2 / STAGE</span><strong>{completed} / {maps} Maps</strong></div>
  </Demo>;
}

export function ClearDemo({ placement = false }) {
  const target = placement ? 2 : 3;
  const playback = useDemoPlayback(placement ? 3 : 5, placement ? 1800 : 2800);
  const clears = Math.min(target, playback.phase);
  const reached = clears === target;
  return <Demo playback={playback} title={placement ? "Placement · 2 Clear" : "일반 Ranked · 3 Clear"}
    description={placement ? "2 Clears 달성 즉시 500점 · S Grade로 Map이 종료됩니다." : "한쪽이 3 Clears에 도달하면 상대에게 LAST ATTEMPT 10초 창이 열립니다."} className="clear-demo">
    <div className="demo-clear-row"><div className="demo-clear-checks">{Array.from({ length: target }, (_, i) => <Check key={i} complete={clears > i} active={clears === i} />)}</div><strong className="demo-clear-count">{clears}<small> / {target} Clears</small></strong></div>
    <div className={`demo-clear-result${reached ? " is-reached" : ""}`}><span>{placement ? "MAP COMPLETE" : "상대 LAST ATTEMPT"}</span><strong>{placement ? "500점 · S" : "10초"}</strong></div>
  </Demo>;
}

export function ScoreDemo() {
  const playback = useDemoPlayback(SCORE_EXAMPLE.progress.length, 4200);
  const progress = SCORE_EXAMPLE.progress[playback.phase];
  const score = attemptExampleScore(progress, SCORE_EXAMPLE.qualifying);
  const band = progress === 100 ? 4 : progress >= 75 ? 3 : progress >= 50 ? 2 : progress >= SCORE_EXAMPLE.qualifying ? 1 : 0;
  return <Demo playback={playback} title="Attempt 점수" description="Qualifying 25%인 맵을 가정한 점수 예시입니다." className="score-demo">
    <div className="demo-score-values"><span><strong>{progress}<small>%</small></strong>진행률</span><span><strong>{score}<small>점</small></strong>{progress === 100 ? "+ 1 Clear" : "Attempt 점수"}</span></div>
    <div className="demo-progress-track"><i style={{ transform: `scaleX(${progress / 100})` }} />{[25, 50, 75].map(value => <span key={value} style={{ left: `${value}%` }} />)}</div>
    <div className="demo-progress-labels"><span>0%</span><span>Q · 25%</span><span>50%</span><span>75%</span><span>100%</span></div>
    <div className="demo-score-bands">{["기준 미달 · 0점", "floor(p)", "floor(p) × 1.5", "floor(p) × 2", "Clear · 250점"].map((label, i) => <span key={label} className={band === i ? "is-current" : ""}>{label}</span>)}</div>
  </Demo>;
}

export function Bo3Demo() {
  const playback = useDemoPlayback(4, 3200);
  const phase = playback.phase;
  return <Demo playback={playback} title="Bo3" description="A가 R1 승리, B가 R2 승리하면 동률이므로 R3을 진행합니다. 이 예시에서는 A가 R3에서 승리합니다." className="bo3-demo compact-demo">
    <div className="demo-rounds">{["A 승", "B 승", "A 승"].map((winner, i) => <div className={`demo-round${phase > i ? " is-finished" : ""}${i === 2 && phase < 2 ? " is-conditional" : ""}`} key={i}><span>R{i + 1}</span><strong>{phase > i ? winner : i === 2 ? "동률 시" : "대기"}</strong>{i < 2 && <i className={phase > i ? "is-connected" : ""}>→</i>}</div>)}</div>
    <div className="demo-bottom-line"><span>{phase === 2 ? "1 : 1 · TIEBREAKER" : phase === 3 ? "2 : 1 · A 승리" : "BEST OF 3"}</span><strong>{phase} / 3 Rounds</strong></div>
  </Demo>;
}

export function StageGradeDemo() {
  const playback = useDemoPlayback(5, 3600);
  const result = stageExampleResult(STAGE_EXAMPLE.mapScores, STAGE_EXAMPLE.pool);
  return <Demo playback={playback} title="Stage 결과" description="Map 1이 400점, Map 2가 300점이면 평균 350점 · A Grade입니다. 이 예시의 다음 Pool은 3에서 4로 이동합니다." className="stage-grade-demo">
    <div className={`demo-merge${playback.phase >= 1 ? " is-merging" : ""}${playback.phase >= 2 ? " is-merged" : ""}`}>
      <div className="demo-map-result"><span>MAP 1</span><strong>400 <small>A</small></strong></div><span className="demo-merge-plus">+</span><div className="demo-map-result"><span>MAP 2</span><strong>300 <small>B</small></strong></div>
      <div className="demo-stage-result"><span>STAGE SCORE</span><strong>{result.score}<small>{result.grade}</small></strong></div>
    </div>
    <div className="demo-stage-equation">(400 + 300) / 2 = <strong>350</strong></div>
    <div className={`demo-pool-move${playback.phase >= 3 ? " is-moved" : ""}`}><span>POOL {STAGE_EXAMPLE.pool}</span><i>→</i><strong>POOL {result.nextPool}</strong><small>A Grade · +1</small></div>
  </Demo>;
}

export function DeathMatchDemo() {
  const playback = useDemoPlayback(6, 4200);
  const phase = playback.phase;
  return <Demo playback={playback} title="Death Match" description="각자 3회 중 최고 진행률을 비교합니다. 예시에서는 A의 91.2%가 B의 86.8%보다 높습니다." className="deathmatch-demo compact-demo">
    <div className="demo-attempt-legend"><span /><span>1회</span><span>2회</span><span>3회</span></div>
    {DEATHMATCH_EXAMPLE.map(player => <div className="demo-attempt-row" key={player.player}><b>{player.player}</b>{player.attempts.map((percent, i) => <span key={i} className={`${phase > i ? "is-recorded" : ""}${phase >= 4 && percent === Math.max(...player.attempts) ? " is-best" : ""}`}>{phase > i ? `${percent}%` : "—"}</span>)}</div>)}
    <div className={`demo-dm-result${phase >= 5 ? " is-decided" : ""}`}><span>BEST %</span><strong>91.2 <i>&gt;</i> 86.8</strong><b>A 승리</b></div>
  </Demo>;
}
