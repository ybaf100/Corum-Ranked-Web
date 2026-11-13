import React, { useEffect, useState } from "react";
import { seasonCountdown, tierLabel } from "./ranked-data.js";

export function Icon({ name }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "sun") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" {...common} /><path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" {...common} /></svg>;
  if (name === "moon") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.4A8 8 0 0 1 8.6 4a7.7 7.7 0 1 0 11.4 11.4Z" {...common} /></svg>;
  if (name === "download") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14" {...common} /></svg>;
  if (name === "refresh") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6" {...common} /></svg>;
  if (name === "info") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" {...common} /><path d="M12 11v6M12 7h.01" {...common} /></svg>;
  if (name === "arrow") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5" {...common} /></svg>;
  if (name === "back") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M10 7l-5 5 5 5" {...common} /></svg>;
  if (name === "down") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" {...common} /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" {...common} /><path d="m16 16 4 4" {...common} /></svg>;
}

const DIFFICULTY_COLORS = {
  0: "#e8eaed", Tiny: "#ff6fff", 1: "#0099ff", 2: "#00bbff", 3: "#00ddff", 4: "#00ffff",
  5: "#00ffaa", 6: "#00ff00", 7: "#66ff00", 8: "#99ff00", 9: "#ccff00", 10: "#ffff00",
  11: "#ffdd00", 12: "#ffcc00", 13: "#ffaa00", 14: "#ff8800", 15: "#ff6600", 16: "#ff4400",
  17: "#ff0000", 18: "#cc0000", "18+": "#a61c00", 19: "#660000", "19+": "#460c00", "20.0": "#360900",
  20.1: "#240600", 20.2: "#130400", 20.3: "#000000", 20.4: "#0a031f", 20.5: "#11072d", 20.6: "#180b3b",
  20.7: "#180b3b", 20.8: "#261358", 20.9: "#2d1766", 21: "#351c75", "21+": "#4511c9",
};
export const DIFFICULTY_ORDER = [
  "0", "Tiny", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "18+", "19", "19+",
  "20.0", "20.1", "20.2", "20.3", "20.4", "20.5", "20.6", "20.7", "20.8",
  "20.9", "21", "21+",
];
export function difficultyIndex(value) { return DIFFICULTY_ORDER.indexOf(/^20(?:\.0+)?$/.test(value) ? "20.0" : value); }
function difficultyTextColor(value) {
  const hex = (DIFFICULTY_COLORS[value] || "#e8eaed").replace("#", ""); const r = Number.parseInt(hex.slice(0, 2), 16); const g = Number.parseInt(hex.slice(2, 4), 16); const b = Number.parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? "#07080d" : "#ffffff";
}
export function DifficultyBadge({ value }) {
  return <span className="difficulty-badge" style={{ "--difficulty": DIFFICULTY_COLORS[value] || "#e8eaed", color: difficultyTextColor(value) }}><span>{value}</span></span>;
}

export function TierBadge({ tier, label }) {
  const value = String(tier || "UNRANKED").toUpperCase();
  const base = value === "MASTER" || value === "CHAMPION" ? "gold" : value.replace(/[123]$/, "").toLowerCase();
  return <span className={`tier-badge tier-${base}${value === "MASTER" || value === "CHAMPION" ? " tier-title" : ""}`}>{label || tierLabel(value)}</span>;
}

export function formatClock(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

/** Title words are split so the last word can take the accent colour. */
export function PageHeading({ number, label, title, accent, description, count, countLabel, action, aside }) {
  return <div className="page-heading">
    <div className="page-heading-copy">
      <p className="section-kicker"><span>{number}</span> / {label}</p>
      <h1>{title}{accent && <> <em>{accent}</em></>}</h1>
      {description && <p className="page-description">{description}</p>}
    </div>
    {countLabel && <div className="total-counter"><strong>{count}</strong><span>{countLabel}</span></div>}
    {aside}
    {action}
  </div>;
}

export function StateCard({ type, title, description, action }) {
  return <div className={`state-card ${type === "error" ? "error-state" : ""}`} role={type === "error" ? "alert" : undefined}>
    <span>{type === "error" ? "LOAD FAILED" : "NO DATA"}</span><h2>{title}</h2><p>{description}</p>{action}
  </div>;
}

export function SearchToolbar({ label, placeholder, query, onQuery, onReload, loading, className = "" }) {
  return <div className={`list-toolbar ${className}`}>
    <label className="search-shell"><Icon name="search" /><span className="sr-only">{label}</span><input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={placeholder} /></label>
    <button className="reload-button" type="button" aria-label="데이터 새로고침" onClick={onReload} disabled={loading}><Icon name="refresh" /><span>새로고침</span></button>
  </div>;
}

/** Ticks once a second; mounted only where a countdown is visible. */
export function useNow(offsetMs = 0) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return now + offsetMs;
}

/** Clock face with only a minute hand, which advances in smooth, even 90° steps. */
export function SeasonClockIcon() {
  return <svg className="season-clock" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path className="season-clock-minute" d="M12 12V5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}

export function seasonText(season, enabled = true) {
  return seasonCountdown(season, enabled, Date.now())?.text ?? null;
}
