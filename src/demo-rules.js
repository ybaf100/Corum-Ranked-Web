// Illustrative evidence only; these helpers never update player or server data.
export const SCORE_EXAMPLE = Object.freeze({ qualifying: 25, progress: Object.freeze([0, 20, 40, 50, 75, 100]) });
export const DEATHMATCH_EXAMPLE = Object.freeze([
  Object.freeze({ player: "A", attempts: Object.freeze([72.5, 91.2, 88.4]) }),
  Object.freeze({ player: "B", attempts: Object.freeze([80, 86.8, 83.9]) }),
]);
export const STAGE_EXAMPLE = Object.freeze({ mapScores: Object.freeze([400, 300]), pool: 3 });

export function attemptExampleScore(progress, qualifying) {
  if (progress === 100) return 250;
  if (progress < qualifying) return 0;
  return Math.floor(progress) * (progress >= 75 ? 2 : progress >= 50 ? 1.5 : 1);
}
export function exampleGrade(score) {
  return score >= 425 ? "S" : score >= 350 ? "A" : score >= 250 ? "B" : score >= 150 ? "C" : "D";
}
export function stageExampleResult(scores, pool) {
  const score = (scores[0] + scores[1]) / 2;
  const grade = exampleGrade(score);
  const mapGrades = scores.map(exampleGrade);
  const movement = grade === "S" ? (mapGrades.every(g => g === "S") ? 2 : 1)
    : grade === "A" ? 1 : grade === "B" ? 0 : grade === "C" ? -1
    : mapGrades.every(g => g === "D") ? -2 : -1;
  return { score, grade, mapGrades, nextPool: Math.max(1, Math.min(6, pool + movement)) };
}
