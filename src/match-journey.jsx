import React, { useLayoutEffect, useRef, useState } from "react";
import { Reveal } from "./motion.jsx";
import { Bo3Demo, DeathMatchDemo } from "./rule-demos.jsx";

const STEP_NOTES = ["10초 밴", "항상 Round 2로", "승수 다르면 종료", "Round 2 동률 시", "Round 3 무승부 시"];

export function MatchJourney({ phases }) {
  const [selected, setSelected] = useState(0);
  const [reveal, setReveal] = useState("static");
  const rail = useRef(null);
  const buttons = useRef([]);
  useLayoutEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || !("IntersectionObserver" in window)) return;
    setReveal("pending");
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setReveal("entered");
        observer.disconnect();
      }
    }, { threshold:0, rootMargin:"0px 0px -32px 0px" });
    observer.observe(rail.current);
    const stopMotion = () => {
      if (preference.matches) { observer.disconnect(); setReveal("static"); }
    };
    preference.addEventListener("change", stopMotion);
    return () => { observer.disconnect(); preference.removeEventListener("change", stopMotion); };
  }, []);
  const choose = (index, moveFocus = false) => {
    setSelected(index);
    if (moveFocus) {
      buttons.current[index]?.focus({ preventScroll:true });
      buttons.current[index]?.scrollIntoView({ block:"nearest", inline:"nearest", behavior:"auto" });
    }
  };
  const onKeyDown = (event, index) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % phases.length;
    if (event.key === "ArrowLeft") next = (index + phases.length - 1) % phases.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = phases.length - 1;
    if (next !== undefined) { event.preventDefault(); choose(next, true); }
  };
  return <div className="match-journey" data-reveal={reveal} onFocusCapture={() => { if (reveal === "pending") setReveal("static"); }}>
    <div className="journey-heading">
      <div><p className="section-kicker">01 / HOW RANKED WORKS</p><h2 id="match-format-title">진행 방식</h2></div>
      <div className="journey-format" aria-label="Best of 3"><span>Best of</span><strong>3<span>.</span></strong></div>
    </div>
    <div className="journey-caption"><p>Round 1 → Round 2 → Round 3</p><span>Round 2 동률 시 Round 3</span></div>
    <div className="journey-rail" ref={rail} role="tablist" aria-label="Ranked 경기 진행 단계" aria-orientation="horizontal">
      {phases.map((phase, index) => <div className={`journey-step${index >= 3 ? " is-conditional" : ""}`} key={phase.step} style={{ "--step-delay":`${index * 90}ms` }} role="presentation">
        <button type="button" ref={element => { buttons.current[index] = element; }} id={`match-step-${index}`} role="tab" aria-selected={selected === index} aria-controls={`match-panel-${index}`} tabIndex={selected === index ? 0 : -1} onClick={() => choose(index)} onKeyDown={event => onKeyDown(event, index)}>
          <span className="journey-step-top"><span>{phase.step}</span><span>{phase.eyebrow}</span></span>
          <strong>{phase.title}</strong>
          <span className="journey-step-note">{STEP_NOTES[index]}</span>
        </button>
        {index < phases.length - 1 && <svg className="journey-arrow" viewBox="0 0 32 20" aria-hidden="true"><path pathLength="1" d="M2 10h26m-6-5 6 5-6 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>)}
    </div>
    <p className="journey-scroll-hint">좌우로 넘겨 단계를 선택하세요.</p>
    <div className="journey-details">
      {phases.map((phase, index) => <div className="journey-panel" id={`match-panel-${index}`} role="tabpanel" aria-labelledby={`match-step-${index}`} tabIndex="0" hidden={selected !== index} key={phase.step}>
        <div className="journey-panel-heading"><span>{phase.step} / {phase.eyebrow}</span><h3>{phase.title}</h3></div>
        <p>{phase.description}</p>
      </div>)}
    </div>
    <div className="journey-examples"><Reveal><Bo3Demo /></Reveal><Reveal><DeathMatchDemo /></Reveal></div>
  </div>;
}
