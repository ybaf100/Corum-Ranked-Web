import React from "react";

const ARTWORK_BASE = `${import.meta.env.BASE_URL}artwork/`;
const ARTWORK_TIERS = ["UNRANKED", "RED", "AQUA", "BRONZE", "SILVER", "GOLD"];
const ARTWORK_SIZES = {
  badge:"(max-width: 700px) 3rem, (max-width: 900px) 3.4rem, 4.3rem",
  gallery:"(max-width: 700px) 6rem, 10rem",
  hero:"(max-width: 700px) 16rem, (max-width: 1300px) 34vw, 28rem",
  side:"(max-width: 700px) 7rem, (max-width: 1300px) 15vw, 12rem",
  leader:"(max-width: 700px) 4rem, 8rem",
  mode:"(max-width: 700px) 7rem, 10rem",
  heading:"(max-width: 480px) 8rem, (max-width: 700px) 7rem, (max-width: 900px) 11rem, 15rem",
};

// Display variants are generated from lossless originals in assets/artwork-originals.
// Source: ybaf100/Corum-Ranked, corum-ranked-mod/resources,
// commit 8e44467e3de4eb6695e103102a8853eb19f57edf.
// Decorative images always keep the adjacent rank/status text authoritative.
export function TierArtwork({ tier, className = "", priority = false, variant = "badge" }) {
  const name = String(tier || "").toUpperCase();
  if (!ARTWORK_TIERS.includes(name)) return null;
  const stem = `${ARTWORK_BASE}corum-trophy-${name.toLowerCase()}`;
  return <img
    className={`tier-artwork artwork-${name.toLowerCase()} ${className}`.trim()}
    src={`${stem}-192.webp`}
    srcSet={`${stem}-96.webp 96w, ${stem}-192.webp 192w, ${stem}-384.webp 384w, ${stem}.webp 768w`}
    sizes={ARTWORK_SIZES[variant] || ARTWORK_SIZES.badge}
    alt="" width="1254" height="1254" decoding="async"
    loading={priority ? "eager" : "lazy"}
    fetchPriority={priority ? "high" : undefined}
  />;
}

export function ArtworkBackdrop() {
  return <img className="artwork-backdrop" src={`${ARTWORK_BASE}rank-transition-background-1280.webp`} srcSet={`${ARTWORK_BASE}rank-transition-background-720.webp 720w, ${ARTWORK_BASE}rank-transition-background-1280.webp 1280w, ${ARTWORK_BASE}rank-transition-background.webp 1920w`} sizes="(max-width: 1280px) 100vw, 1200px" alt="" width="1920" height="1080" decoding="async" />;
}

export function RankShowcase() {
  return <div className="rank-showcase" aria-hidden="true">
    <div className="showcase-halo" />
    <TierArtwork tier="AQUA" className="showcase-side showcase-left" variant="side" />
    <TierArtwork tier="SILVER" className="showcase-side showcase-right" variant="side" />
    <TierArtwork tier="GOLD" className="showcase-center" variant="hero" priority />
    <div className="showcase-plinth" />
  </div>;
}

export function RankGallery() {
  return <ul className="rank-gallery" aria-label="Ranked 티어">
    {ARTWORK_TIERS.map((tier, index) => <li key={tier} className={`rank-gallery-item tier-${tier.toLowerCase()}`} style={{ "--tier-index": index }}>
      <TierArtwork tier={tier} variant="gallery" />
      <span>{tier}</span>
    </li>)}
  </ul>;
}
