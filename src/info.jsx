import React, { useMemo } from "react";
import { Reveal, Disclosure, scrollToSection } from "./motion.jsx";
import { StageRunDemo, ClearDemo, ScoreDemo, StageGradeDemo } from "./rule-demos.jsx";
import { TierArtwork, ArtworkBackdrop, RankShowcase, RankGallery } from "./artwork.jsx";
import { MatchJourney } from "./match-journey.jsx";
import { DEFAULT_RULES, bandForScore, tierLabel } from "./ranked-data.js";
import { POOLS } from "./maps.jsx";
import { Icon, PageHeading, StateCard, TierBadge, formatClock, seasonText } from "./ui.jsx";

const SCORE_RULES = [
  { range: "< Qualifying", score: "0점", detail: "기준 미달" },
  { range: "Qualifying–<50%", score: "진행률", detail: "floor(progress)" },
  { range: "50–<75%", score: "× 1.5", detail: "floor(progress) 기준" },
  { range: "75–<100%", score: "× 2", detail: "floor(progress) 기준" },
  { range: "100%", score: "250점", detail: "+ 1 Clear" },
];
const PLACEMENT_GRADES = [
  { grade: "S", range: "425–500", movement: "+1", detail: "두 맵 모두 S면 +2" },
  { grade: "A", range: "350–<425", movement: "+1", detail: "다음 Stage Pool 상승" },
  { grade: "B", range: "250–<350", movement: "0", detail: "Pool 유지" },
  { grade: "C", range: "150–<250", movement: "−1", detail: "다음 Stage Pool 하락" },
  { grade: "D", range: "0–<150", movement: "−1", detail: "두 맵 모두 D면 −2" },
];
// Survival operating formats (server targets; tied players at a cutoff all advance).
const SURVIVAL_FORMATS = {
  16: [16, 10, 6, 3, 1],
  64: [64, 40, 26, 12, 5, 1],
};
// Default finishing-place LP for a 16-player field; 64-player fields map by place ratio.
const SURVIVAL_LP = [50, 40, 30, 25, 20, 15, 10, 8, 5, 2, -10, -20, -30, -40, -50, -55];
const PLACEMENT_SKIP_LP = 150;

/** BO3 shows five ban candidates, a single game four (server candidatePoolDistribution). */
export function poolDistribution(mainPool, format = "BO3") {
  const counts = [0, 0, 0, 0, 0, 0];
  const single = format === "SINGLE";
  if (mainPool === 1) { counts[0] = 2; counts[1] = single ? 1 : 2; counts[2] = 1; }
  else if (mainPool === 6) { counts[3] = 1; counts[4] = single ? 1 : 2; counts[5] = 2; }
  else if (mainPool >= 2 && mainPool <= 5) { counts[mainPool - 2] = 1; counts[mainPool - 1] = single ? 2 : 3; counts[mainPool] = 1; }
  return counts;
}

function formatName(format) { return format === "SINGLE" ? "단판" : "BO3"; }
function formatsOf(tiers) {
  const formats = [...new Set(tiers.map((tier) => tier.matchFormat))];
  return formats.length ? formats : ["BO3"];
}
function formatSummary(tiers) {
  const formats = formatsOf(tiers);
  if (formats.length === 1) return formatName(formats[0]);
  return formats.includes("SINGLE") ? "단판 / BO3" : "BO3";
}
/** "RED · AQUA" for the base tiers that use one format. */
function tiersUsing(tiers, format) {
  return [...new Set(tiers.filter((tier) => tier.matchFormat === format).map((tier) => tier.baseTier))].join(" · ");
}
function promotionRows(tiers) {
  return tiers.flatMap((tier, index) => {
    if (!tier.promotionGames) return [];
    const target = tiers.slice(index + 1).find((next) => next.baseTier !== tier.baseTier);
    return target ? [{ from: tier, to: target }] : [];
  });
}

function matchPhases(rules, tiers) {
  const ban = rules.banSeconds;
  const hasSingle = tiers.some((tier) => tier.matchFormat === "SINGLE");
  const singleTiers = tiersUsing(tiers, "SINGLE");
  return [
    { step: "01", eyebrow: "MATCH FOUND", title: "매칭 · 밴", note: `${ban}초 밴`,
      description: `두 플레이어의 Hidden MMR 평균으로 effective tier를 정하고, 그 티어의 Main Pool을 중심으로 맵 후보를 뽑습니다. BO3 티어는 후보 5개, 단판 티어는 후보 4개이며 밴이 켜진 티어는 ${ban}초 동안 서로 보이지 않게 밴합니다.` },
    { step: "02", eyebrow: "OPENING", title: "Round 1", note: hasSingle ? "단판은 여기서 결정" : "항상 Round 2로",
      description: hasSingle ? `첫 번째 맵에서 일반 라운드를 진행합니다. 단판 티어${singleTiers ? `(${singleTiers})` : ""}는 이 라운드로 승부가 나고 무승부면 Death Match로 이동합니다. BO3 티어는 결과와 관계없이 Round 2로 이동합니다.` : "첫 번째 맵에서 일반 라운드를 진행합니다. 결과와 관계없이 Round 2로 이동합니다." },
    { step: "03", eyebrow: "MATCH POINT", title: "Round 2", note: "BO3 · 승수 다르면 종료", conditional: hasSingle,
      description: "BO3 티어만 진행합니다. 두 라운드 후 승수가 다르면 매치가 끝나고, 같으면 Round 3으로 이동합니다." },
    { step: "04", eyebrow: "TIEBREAKER", title: "Round 3", note: "Round 2 동률 시", conditional: true,
      description: "비무승부면 최종 승자가 정해지고, 라운드 무승부면 Death Match로 이동합니다." },
    { step: "05", eyebrow: "IF TIED", title: "Death Match", note: "결정 라운드 무승부 시", conditional: true,
      description: "티어의 Deathmatch Pool에서 새 맵을 뽑습니다. 각자 정확히 3 scored Attempts 중 authoritative raw progress percentage의 최고값 1개를 비교합니다. Qualifying %와 일반 Attempt 점수 배율은 적용하지 않으며 Clear는 100%입니다. 최고 진행률이 같으면 새 맵으로 반복합니다." },
  ];
}

function MatchProgression({ rules, tiers }) {
  const roundRules = [
    { value: formatClock(rules.roundSeconds), label: "MAIN TIME", title: "일반 라운드", description: `${formatClock(rules.roundSeconds)} 동안 새 Attempt를 시작할 수 있습니다.` },
    { value: `+${formatClock(rules.finalAttemptWindowSeconds)}`, label: "FINAL ATTEMPT", title: "마지막 시작 구간", description: `메인 시간이 끝난 뒤 ${rules.finalAttemptWindowSeconds}초 동안 추가 Attempt 시작이 가능합니다. 이미 시작된 Attempt는 자연 종료까지 정산됩니다.` },
    { value: String(rules.clearTarget), label: "CLEAR TARGET", title: `${rules.clearTarget}-Clear`, description: `한쪽이 ${rules.clearTarget} Clears에 도달하면 상대에게 별도 LAST ATTEMPT 창이 열립니다.` },
    { value: `${rules.lastAttemptWindowSeconds}s`, label: "LAST ATTEMPT", title: "동점 기회", description: `상대가 ${rules.lastAttemptWindowSeconds}초 안에 필요한 Attempt를 시작해 ${rules.clearTarget} Clears를 맞추면 라운드 무승부, 실패하면 trigger side가 승리합니다.` },
  ];
  const singleTiers = tiersUsing(tiers, "SINGLE"); const bo3Tiers = tiersUsing(tiers, "BO3");
  return <section className="match-format-section chapter" id="match-format" tabIndex="-1" aria-labelledby="match-format-title">
    <MatchJourney phases={matchPhases(rules, tiers)} formatLabel={formatSummary(tiers)}
      caption={singleTiers ? `단판 ${singleTiers} · BO3 ${bo3Tiers}` : "Round 1 → Round 2 → Round 3"}
      captionNote={singleTiers ? "형식은 effective tier가 정합니다" : "Round 2 동률 시 Round 3"} />
    <Reveal className="round-rules-section">
      <div className="composition-title-line"><div><p className="section-kicker">NORMAL ROUND</p><h2>한 라운드의 기준</h2></div><span>{formatClock(rules.roundSeconds)} / {rules.clearTarget} CLEAR</span></div>
      <div className="round-rule-grid">
        {roundRules.map((rule) => <details className="round-rule-card" key={rule.label}>
          <summary><span className="round-stat"><strong>{rule.value}</strong><span>{rule.label}</span></span><span className="round-rule-title"><strong>{rule.title}</strong><i aria-hidden="true">+</i></span></summary>
          <p>{rule.description}</p>
        </details>)}
      </div>
      <ClearDemo />
    </Reveal>
    <Reveal className="score-rule-shell">
      <Disclosure eyebrow="ROUND SCORING" title="Attempt 점수">
        <p className="score-introduction">맵별 Qualifying 기준을 통과한 뒤 구간별 배율을 적용합니다.</p>
        <ScoreDemo />
        <div className="score-rule-grid">{SCORE_RULES.map((rule) => <div className="score-rule" key={rule.range}><span>{rule.range}</span><strong>{rule.score}</strong><small>{rule.detail}</small></div>)}</div>
      </Disclosure>
    </Reveal>
    <Reveal className="authority-note"><span>SERVER AUTHORITATIVE</span><p>시간, Attempt 승인, 점수, Clear, 라운드와 최종 승자는 Ranked 서버가 판정합니다. 최종 매치 draw는 없고 승자가 나올 때까지 Death Match가 반복됩니다.</p></Reveal>
  </section>;
}

function RankedPolicyOverview() {
  return <section className="policy-section chapter" id="ranked-policy" tabIndex="-1">
    <Reveal className="chapter-heading"><p className="section-kicker"><span>02</span> / RANK &amp; PROGRESSION</p><h2>랭크를 만드는 기준</h2></Reveal>
    <Reveal><RankGallery /></Reveal>
    <div className="ranked-policy-grid">
      <Reveal><Disclosure className="policy-card" eyebrow="HIDDEN MMR / VISIBLE LP" title="MMR과 LP"><p>Hidden MMR은 매칭과 LP 보정에 사용되지만 공개되지 않습니다. MMR이 현재 LP보다 높으면 승리 시 더 많이 오르고 패배 시 덜 내려가며, 낮으면 반대로 적용됩니다. 상대의 강약도 함께 반영됩니다.</p></Disclosure></Reveal>
      <Reveal><Disclosure className="policy-card" eyebrow="DIVISIONS / GOLD TITLES" title="디비전과 GOLD 칭호"><p>RED·AQUA·BRONZE·SILVER는 III → II → I 세 디비전으로 나뉘고, 디비전 사이는 LP만으로 오르내립니다. GOLD 안에서는 서버가 순위로 칭호를 계산합니다. 상위 3명은 CHAMPION, GOLD 인원이 7명 이상이면 상위 절반(반올림)까지 MASTER, 나머지는 GOLD입니다. 칭호에는 별도 LP·승급전·강등 보호가 없습니다.</p></Disclosure></Reveal>
      <Reveal><Disclosure className="policy-card" eyebrow="PROMOTION" title="승급전"><p>승리로 LP가 다음 기본 티어의 하한(예: AQUA III)에 닿으면 LP를 하한−1에 고정하고 승급전을 시작합니다. 승급전은 각 티어의 I 단계에만 있고, 판수와 필요 승수는 아래 실시간 표를 따릅니다. 승급전 중에도 Hidden MMR과 streak는 계속 변합니다.</p></Disclosure></Reveal>
      <Reveal><Disclosure className="policy-card" eyebrow="PERFECT WIN" title="Perfect Win"><p>최종 승자가 한 Round도 패배하지 않고, 모든 결정 승리를 실제 Clear 목표 달성으로 만든 경우에만 인정됩니다. Round draw는 허용되지만 score win, forfeit, forced win, Death Match 승리는 조건을 만족하지 않습니다.</p></Disclosure></Reveal>
    </div>
  </section>;
}

function PlacementSummary({ onOpenPlacement }) {
  return <Reveal as="section" className="placement-summary chapter" id="placement-summary" tabIndex="-1">
    <div className="placement-summary-copy">
      <p className="section-kicker"><span>03</span> / SOLO STAGE PLACEMENT</p>
      <h2>배치 경기</h2>
      <p>Placement는 PvP가 아니라 싱글플레이 Stage 방식입니다. 3 Stage 또는 5 Stage를 선택하고, Stage마다 서로 다른 2개 맵을 플레이해 Map Score와 Grade를 쌓습니다.</p>
      <button className="cta-button" type="button" onClick={onOpenPlacement}><span>자세히 보기</span><Icon name="arrow" /></button>
    </div>
    <div className="placement-summary-visual">
      <div className="placement-lengths" aria-label="3 Stage 또는 5 Stage"><strong>3</strong><span>or</span><strong>5</strong></div>
      <div className="placement-summary-facts"><span><strong>3 / 5</strong> STAGES</span><span><strong>2</strong> MAPS / STAGE</span><span><strong>3:00</strong> MAP TIME</span><span><strong>2</strong> CLEAR TARGET</span></div>
      <StageRunDemo stages={3} compact />
    </div>
  </Reveal>;
}

/** Distribution rows per base tier: divisions inside a tier share pools and format. */
function distributionRows(tiers) {
  const rows = [];
  for (const tier of tiers) {
    const last = rows.at(-1);
    if (last && last.baseTier === tier.baseTier && last.mainPool === tier.mainPool && last.matchFormat === tier.matchFormat) continue;
    rows.push({ key: tier.tier, baseTier: tier.baseTier, mainPool: tier.mainPool, matchFormat: tier.matchFormat });
  }
  return rows;
}

function LiveTiers({ maps, mapsLoading, tierState, config, reload }) {
  const { tiers, gold, source, loading, error } = tierState;
  const poolCounts = useMemo(() => POOLS.map((pool) => maps.filter((map) => map.pool === pool).length), [maps]);
  const demotionPenalty = Number(config.demotionScorePenalty) || 0;
  const promotions = promotionRows(tiers);
  return <section className="live-information chapter" id="ranked-tiers" tabIndex="-1">
    <Reveal className="chapter-heading live-heading"><div><p className="section-kicker"><span>04</span> / LIVE TIER &amp; POOL DATA</p><h2>티어와 Pool</h2></div><button className="reload-button" type="button" aria-label="티어 정보 새로고침" onClick={reload} disabled={loading}><Icon name="refresh" /><span>정보 새로고침</span></button></Reveal>
    {error ? <StateCard type="error" title="운영 정보를 불러오지 못했습니다." description={error} action={<button className="primary-button" type="button" onClick={reload}>다시 시도</button>} /> : <>
      <Reveal className="info-section-shell">
        <Disclosure eyebrow={source === "api" ? "TIER BANDS · Ranked 서버 실시간" : "TIER BANDS · 운영 시트"} title="티어 구간 · 매치 형식 · 승급전" open>
          <div className="table-scroll" role="region" aria-label="티어 구간과 매치 형식 표" tabIndex="0"><table className="tier-rule-table"><thead><tr><th>티어</th><th>LP 구간</th><th>매치 형식</th><th>승급전</th><th>Main Pool</th><th>DM Pool</th><th>강등 보호</th></tr></thead><tbody>{loading ? <tr><td colSpan="7">불러오는 중…</td></tr> : tiers.map((tier, index) => {
            const next = tiers.slice(index + 1).find((item) => item.baseTier !== tier.baseTier);
            return <tr key={tier.tier} data-tier={tier.baseTier.toLowerCase()}>
              <td><TierBadge tier={tier.tier} label={tier.label} /></td>
              <td><strong className="tabular">{tier.minimum.toLocaleString()} ~ {tier.maximum === null ? "∞" : (tier.maximum - 1).toLocaleString()} LP</strong></td>
              <td><strong>{formatName(tier.matchFormat)}</strong><small>{tier.mapBan ? "맵 밴 있음" : "맵 밴 없음"}</small></td>
              <td>{tier.promotionGames && next ? <><strong>→ {tierLabel(next.tier)}</strong><small>{tier.promotionGames}전 {tier.promotionWinsRequired}승</small></> : <span className="muted-cell">{tier.baseTier === "GOLD" ? "최상위" : "LP로 이동"}</span>}</td>
              <td>Pool {tier.mainPool}</td><td>Pool {tier.deathmatchPool}</td>
              <td>{tier.demotionProtection ? <span className="protect-mark">보호</span> : <span className="muted-cell">—</span>}</td>
            </tr>;
          })}</tbody></table></div>
        </Disclosure>
      </Reveal>
      {!loading && promotions.length > 0 && <Reveal className="promotion-strip" aria-label="승급전 요약">{promotions.map(({ from, to }) => <div key={from.tier}><span>{from.label} → {to.label}</span><strong>{from.promotionGames}<small>전</small> {from.promotionWinsRequired}<small>승</small></strong></div>)}</Reveal>}
      {gold && <Reveal className="gold-titles" aria-label="GOLD 칭호 현황">
        <div className="gold-titles-copy"><p className="section-kicker">GOLD TITLES · LIVE</p><h3>CHAMPION · MASTER</h3><p>GOLD {gold.total}명(봇 포함) 기준. 칭호는 순위로 계산되며 같은 LP는 서버 순위 순서를 따릅니다.</p></div>
        <dl>
          <div><dt>CHAMPION</dt><dd><strong>{gold.championSlots}</strong><span>{gold.championCutoffLp === null ? "커트 없음" : `${gold.championCutoffLp.toLocaleString()} LP 이상`}</span></dd></div>
          <div><dt>MASTER</dt><dd><strong>{gold.masterSlots}</strong><span>{gold.masterCutoffLp === null ? "커트 없음" : `${gold.masterCutoffLp.toLocaleString()} LP 이상`}</span></dd></div>
          <div><dt>GOLD</dt><dd><strong>{gold.goldSlots}</strong><span>나머지</span></dd></div>
        </dl>
      </Reveal>}
      <Reveal className="demotion-panel">
        <Disclosure eyebrow="DEMOTION POLICY" title="강등 조건">
          <ol><li>패배 예상 LP가 현재 기본 티어의 하한(III 단계 하한) 아래면 먼저 LP를 하한에 고정합니다. 디비전 경계(II, I)에는 보호가 없어 LP대로 내려갑니다.</li><li>Hidden MMR이 하한 이상이거나 최하위 티어면 경고 없이 하한을 유지합니다. Hidden MMR도 하한 미만이면 첫 qualifying loss에서 <strong>DEMOTION WARNING</strong>이 켜집니다.</li><li>경고 상태에서 다음 qualifying loss가 발생하면 강등됩니다.{demotionPenalty ? <> 기본 운영값은 새 tier 기준 <strong>{demotionPenalty} LP</strong> penalty를 사용합니다.</> : null} 승리하면 경고가 해제됩니다.</li></ol>
        </Disclosure>
      </Reveal>
      <Reveal className="pool-count-strip">{POOLS.map((pool, index) => <div className="pool-count" data-pool={pool} key={pool}><span>POOL {pool}</span><strong>{mapsLoading ? "—" : poolCounts[index]}</strong><small>등록 맵</small></div>)}</Reveal>
      <Reveal className="composition-table-shell">
        <Disclosure eyebrow="BAN CANDIDATES · BO3 5개 / 단판 4개" title="Main Pool별 후보 분포">
          <div className="table-scroll" role="region" aria-label="Main Pool별 맵 후보 분포 표" tabIndex="0"><table><thead><tr><th>티어</th><th>Main</th><th>형식</th>{POOLS.map((pool) => <th key={pool}>Pool {pool}</th>)}<th>합계</th></tr></thead><tbody>{loading ? <tr><td colSpan="10">불러오는 중…</td></tr> : distributionRows(tiers).map((row) => {
            const counts = poolDistribution(row.mainPool, row.matchFormat);
            return <tr key={`dist-${row.key}`}><td><TierBadge tier={row.baseTier} /></td><td><strong>Pool {row.mainPool}</strong></td><td>{formatName(row.matchFormat)}</td>{counts.map((count, index) => <td key={index}><span className={`distribution-value${count ? " is-active" : ""}`}>{count || "—"}</span></td>)}<td><strong className="distribution-total">{counts.reduce((sum, value) => sum + value, 0)}</strong></td></tr>;
          })}</tbody></table></div>
        </Disclosure>
      </Reveal>
    </>}
  </section>;
}

function SurvivalChapter({ survival, rankedConfig, tiers }) {
  const count = survival?.playerCount;
  const formats = count ? [count] : [16, 64];
  const minima = ["RED", "AQUA", "BRONZE", "SILVER", "GOLD"].map((base) => ({ base, minimum: tiers.find((tier) => tier.baseTier === base)?.minimum }));
  return <section className="survival-section chapter" id="survival" tabIndex="-1">
    <Reveal className="chapter-heading survival-heading">
      <div><p className="section-kicker"><span>05</span> / SURVIVAL MODE</p><h2>서바이벌</h2></div>
      <div className="survival-status">{rankedConfig ? <><span className={"mode-status " + (survival.enabled ? "is-open" : "is-closed")}><i aria-hidden="true" />{survival.enabled ? "운영 중" : "닫힘"}</span>{count && <span>{count}인 운영</span>}<span>{seasonText(rankedConfig.seasons.survival)}</span></> : <span className="mode-status is-unknown"><i aria-hidden="true" />상태 확인 불가</span>}</div>
    </Reveal>
    <Reveal className="survival-intro"><p>여러 명이 같은 맵을 동시에 플레이하고, 라운드마다 최고 진행률 상위권만 다음 라운드로 올라가는 모드입니다. Solo Ranked와 LP·순위·시즌이 따로 관리되고, 배치 경기와 승급전이 없습니다.</p></Reveal>
    {formats.map((players) => <Reveal key={players} className="survival-bracket" aria-label={`${players}인 운영 라운드별 통과 목표`}>
      <div className="survival-bracket-label"><strong>{players}</strong><span>PLAYERS</span></div>
      <ol>{SURVIVAL_FORMATS[players].map((value, index, all) => <li key={index} style={{ "--step-delay": `${index * 80}ms` }} className={index === all.length - 1 ? "is-final" : ""}>
        <span>{index === 0 ? "START" : index === all.length - 1 ? "FINAL" : `R${index} 통과`}</span><strong>{value}</strong>
      </li>)}</ol>
    </Reveal>)}
    <div className="survival-rule-grid">
      <Reveal as="article"><span>ROUND</span><h3>최고 진행률로 생존</h3><p>각 라운드는 서버 기준 3분입니다. 재시작·사망으로 최고 기록이 줄지 않으며, 컷 동점자는 모두 통과합니다. 인원이 모자라면 최대 3분 대기 후 최소 8명부터 인원 비율에 맞춰 목표를 줄여 시작합니다.</p></Reveal>
      <Reveal as="article"><span>FINAL</span><h3>단독 1위가 우승</h3><p>결승 공동 1위만 Death Match로 갑니다. 각자 최대 3 Attempts의 최고 기록을 0.001% 단위로 비교하고, 같으면 새 맵에서 반복합니다. 우승자는 항상 한 명입니다.</p></Reveal>
      <Reveal as="article"><span>LP</span><h3>최종 순위로 정산</h3><p>시작 LP는 150입니다. 공동 순위는 함께 차지한 순위 중 가장 낮은 순위의 LP를 받습니다. 64인 경기는 아래 16단계 표를 순위 비율로 적용합니다.</p></Reveal>
    </div>
    <Reveal className="survival-lp" aria-label="16인 기준 순위별 LP">
      <div className="survival-lp-head"><span>16인 기준 순위 LP</span><span>우승 +50 · 최하위 −55</span></div>
      <ol>{SURVIVAL_LP.map((value, index) => <li key={index} className={value >= 0 ? "is-gain" : "is-loss"}><span>{index + 1}위</span><strong>{value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : value}</strong></li>)}</ol>
    </Reveal>
    <Reveal className="survival-tiers" aria-label="Survival 티어">
      <p><strong>Survival 티어</strong> 디비전 없이 다섯 단계이며, 하한은 Solo 각 티어의 III 단계 하한과 같습니다. 하한 아래로 떨어질 때는 강등 경고를 먼저 받습니다.</p>
      <ul>{minima.map(({ base, minimum }) => <li key={base}><TierBadge tier={base} /><span>{Number.isFinite(minimum) ? `${minimum.toLocaleString()} LP~` : "—"}</span></li>)}</ul>
    </Reveal>
  </section>;
}

export function Information({ maps, mapsLoading, tierState, rankedConfig, sheetConfig, reloadTiers, onOpenPlacement }) {
  const rules = rankedConfig.data?.rules || DEFAULT_RULES;
  const tiers = tierState.tiers;
  const chapters = [["match-format", "진행 방식"], ["ranked-policy", "랭크와 점수"], ["placement-summary", "배치 경기"], ["ranked-tiers", "티어와 Pool"], ["survival", "서바이벌"]];
  return <section className="tab-page information-page">
    <header className="guide-hero">
      <div className="guide-hero-copy">
        <p className="section-kicker">CORUM RANKED / RULES &amp; FORMAT{rankedConfig.data?.rulesVersion ? <> · <span>{rankedConfig.data.rulesVersion}</span></> : null}</p>
        <h1>The rule <em>book</em></h1>
        <p>첫 매칭부터 승급까지. 플레이에 필요한 모든 기준.</p>
        <button className="text-link" type="button" onClick={() => scrollToSection("match-format")}><span>진행 방식 살펴보기</span><Icon name="arrow" /></button>
      </div>
      <div className="guide-stage"><ArtworkBackdrop /><RankShowcase /></div>
      <dl className="guide-facts">
        <div><dt>MATCH FORMAT</dt><dd>{tierState.loading ? "—" : formatSummary(tiers)}</dd></div>
        <div><dt>ROUND TIME</dt><dd><em>{formatClock(rules.roundSeconds)}</em></dd></div>
        <div><dt>CLEAR TARGET</dt><dd><em>{rules.clearTarget}</em> Clears</dd></div>
      </dl>
    </header>
    <nav className="chapter-links" aria-label="정보 목차">
      {chapters.map(([id, label], index) => <button key={id} type="button" onClick={() => scrollToSection(id)}><span>0{index + 1}</span>{label}</button>)}
    </nav>
    <MatchProgression rules={rules} tiers={tiers} />
    <RankedPolicyOverview />
    <PlacementSummary onOpenPlacement={onOpenPlacement} />
    <LiveTiers maps={maps} mapsLoading={mapsLoading} tierState={tierState} config={sheetConfig} reload={reloadTiers} />
    <SurvivalChapter survival={rankedConfig.data?.modes.survival} rankedConfig={rankedConfig.data} tiers={tiers} />
  </section>;
}

export function PlacementInformation({ onBack, tiers }) {
  const skipBand = bandForScore(tiers, PLACEMENT_SKIP_LP);
  const bronze = tiers.find((tier) => tier.baseTier === "BRONZE");
  const capScore = bronze ? bronze.minimum - 16 : null;
  const capBand = capScore === null ? null : bandForScore(tiers, capScore);
  return <section className="tab-page placement-page">
    <div className="placement-page-nav"><button type="button" onClick={onBack}><Icon name="back" /><span>정보로 돌아가기</span></button><span>RANKED INFO / PLACEMENT</span></div>
    <PageHeading number="03.1" label="SOLO STAGE PLACEMENT" title="Find your" accent="rank" description="혼자 플레이하고, 나의 출발점을 결정하세요. 배치는 PvP가 아닌 싱글플레이 Stage Run입니다." aside={<TierArtwork tier="UNRANKED" className="page-heading-artwork" variant="heading" priority />} />
    <div className="placement-mode-grid">{[3, 5].map((stages) => <Reveal as="article" key={stages} data-stages={stages}>
      <TierArtwork tier={stages === 3 ? "AQUA" : "GOLD"} className="mode-artwork" variant="mode" />
      <div className="mode-card-heading"><span>{stages === 3 ? "QUICK RUN" : "FULL RUN"}</span><span>{stages * 2} MAPS</span></div>
      <h2><strong>{stages}</strong> Stage</h2>
      <StageRunDemo stages={stages} />
      <p>{stages === 3 ? <>총 6맵으로 빠르게 배치됩니다. 최종 Placement는 <b>{capBand ? `${capBand.label} ${capScore.toLocaleString()} LP` : "AQUA 최상단"}</b>를 넘을 수 없습니다.</> : <>총 10맵을 플레이하며 <b>전체 Placement 범위</b>를 사용합니다.</>}</p>
    </Reveal>)}</div>
    <Reveal as="section" className="placement-detail-section">
      <div className="composition-title-line"><div><p className="section-kicker">01 / SETUP</p><h2>시작 Pool과 Run 길이</h2></div><span>시작 후 변경 불가</span></div>
      <p>Run 시작 전에 3 Stage 또는 5 Stage와 본인이 생각하는 시작 실력대인 <b>POOL 1–POOL 6</b>을 선택합니다. 높은 Pool을 고른다고 최종 티어가 보장되지는 않습니다. 같은 Stage의 두 canonical map은 반드시 서로 다릅니다.</p>
      <div className="placement-callout"><strong>SKIP PLACEMENT</strong><p>Run 시작 전에는 Placement를 건너뛸 수 있습니다. 확인하면 <b>{PLACEMENT_SKIP_LP} LP{skipBand ? ` (${skipBand.label})` : ""}</b>로 배치가 확정되며 중복 적용되지 않습니다.</p></div>
    </Reveal>
    <Reveal as="section" className="placement-detail-section">
      <div className="composition-title-line"><div><p className="section-kicker">02 / MAP RULE</p><h2>각 맵 진행 방식</h2></div><span>3:00 + FINAL ATTEMPT</span></div>
      <div className="placement-stat-grid"><article><strong>180s</strong><span>MAIN TIME</span><p>3분 동안 Attempt를 시작합니다.</p></article><article><strong>10s</strong><span>FINAL ATTEMPT</span><p>마지막 10초 안에 시작이 승인된 Attempt는 deadline 뒤에도 자연 종료까지 정산됩니다.</p></article><article><strong>2</strong><span>CLEAR TARGET</span><p>2 Clears를 달성하면 즉시 500점 · S Grade로 맵이 끝납니다.</p></article><article><strong>TOP 2</strong><span>MAP SCORE</span><p>유효 Attempt의 awarded score 중 상위 2개를 합산합니다.</p></article></div>
      <ClearDemo placement />
      <div className="score-rule-shell placement-score-shell"><div className="score-rule-heading"><div><p className="section-kicker">SAME ATTEMPT CURVE</p><h3>Attempt 점수</h3></div><p>일반 Ranked와 동일한 scoring curve를 사용합니다.</p></div><div className="score-rule-grid">{SCORE_RULES.map((rule) => <div className="score-rule" key={`placement-${rule.range}`}><span>{rule.range}</span><strong>{rule.score}</strong><small>{rule.detail}</small></div>)}</div></div>
    </Reveal>
    <Reveal as="section" className="placement-detail-section">
      <div className="composition-title-line"><div><p className="section-kicker">03 / GRADE &amp; POOL</p><h2>Map / Stage Grade</h2></div><span>Stage Score = 두 Map 평균</span></div>
      <StageGradeDemo />
      <div className="placement-grade-grid">{PLACEMENT_GRADES.map((item) => <article className={`grade-${item.grade.toLowerCase()}`} key={item.grade}><strong>{item.grade}</strong><div><span>{item.range}</span><b>{item.movement}</b><small>{item.detail}</small></div></article>)}</div>
      <p className="placement-muted">Stage Score는 두 Map Score의 평균입니다. Stage Grade에 따라 다음 Stage Pool이 이동하고 Pool은 1–6 범위로 제한됩니다.</p>
    </Reveal>
    <Reveal as="section" className="placement-detail-section">
      <div className="composition-title-line"><div><p className="section-kicker">04 / RESULT</p><h2>최종 배치 산정</h2></div><span>SERVER AUTHORITATIVE</span></div>
      <div className="placement-result-flow">
        <article><span>1</span><h3>전체 evidence</h3><p>3 Stage는 6 Map + 3 Stage, 5 Stage는 10 Map + 5 Stage의 실제 score·Grade·Pool을 모두 사용합니다.</p></article>
        <article><span>2</span><h3>Placement Rating</h3><p>Pool anchor와 normalized performance를 이용해 Placement Rating을 계산합니다.</p></article>
        <article><span>3</span><h3>MMR → LP / Tier</h3><p>Placement Rating을 Hidden MMR로 연결한 뒤 LP와 디비전 티어를 확정합니다.</p></article>
        <article><span>4</span><h3>경계 보호</h3><p>기본 티어 경계(각 III 단계 하한)의 ±15 구간에는 배치하지 않고 경계−16으로 내려 경계 배치를 피합니다. 디비전 경계에는 적용하지 않습니다. 3 Stage에는 추가로 AQUA 상한이 적용됩니다.</p></article>
      </div>
    </Reveal>
    <Reveal as="section" className="placement-detail-section">
      <div className="composition-title-line"><div><p className="section-kicker">SAVE / RESUME</p><h2>중단 후 이어하기</h2></div><span>STATE PERSISTED</span></div>
      <p>Stage Result에서 <b>PLAY LATER</b>를 선택하면 현재 Stage 결과가 서버에 저장되고, 이후 <b>CONTINUE PLACEMENT</b>로 이어서 진행할 수 있습니다. reconnect나 server restart 뒤에도 현재 Stage·Map·Attempt·result/finalization 상태를 복구하도록 설계되어 있습니다.</p>
    </Reveal>
  </section>;
}
