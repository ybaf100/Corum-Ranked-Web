import React from "react";

const ARTWORK_BASE = `${import.meta.env.BASE_URL}artwork/`;
const ARTWORK_TIERS = ["UNRANKED", "RED", "AQUA", "BRONZE", "SILVER", "GOLD"];

// Official game artwork; WebP files preserve the source pixels losslessly.
// Source: ybaf100/Corum-Ranked, corum-ranked-mod/resources,
// commit 8e44467e3de4eb6695e103102a8853eb19f57edf.
// Decorative images always keep the adjacent rank/status text authoritative.
export function TierArtwork({ tier, className = "", priority = false }) {
  const name = String(tier || "").toUpperCase();
  if (!ARTWORK_TIERS.includes(name)) return null;
  return <img
    className={`tier-artwork artwork-${name.toLowerCase()} ${className}`.trim()}
    src={`${ARTWORK_BASE}corum-trophy-${name.toLowerCase()}.webp`}
    alt="" width="1254" height="1254" decoding="async"
    loading={priority ? "eager" : "lazy"}
    fetchPriority={priority ? "high" : undefined}
  />;
}

export function ArtworkBackdrop() {
  return <img className="artwork-backdrop" src={`${ARTWORK_BASE}rank-transition-background.webp`} alt="" width="1920" height="1080" decoding="async" />;
}

export function RankShowcase() {
  return <div className="rank-showcase" aria-hidden="true">
    <div className="showcase-halo" />
    <TierArtwork tier="AQUA" className="showcase-side showcase-left" />
    <TierArtwork tier="SILVER" className="showcase-side showcase-right" />
    <TierArtwork tier="GOLD" className="showcase-center" priority />
    <div className="showcase-plinth" />
  </div>;
}

export function RankGallery() {
  return <ul className="rank-gallery" aria-label="Ranked 티어">
    {ARTWORK_TIERS.map((tier) => <li key={tier} className={`rank-gallery-item tier-${tier.toLowerCase()}`}>
      <TierArtwork tier={tier} />
      <span>{tier}</span>
    </li>)}
  </ul>;
}
