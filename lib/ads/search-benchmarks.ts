/** Typical click-through rate for a Google search result at that rank. */

const CTR_BY_RANK = [
  0,
  0.285, // 1
  0.157,
  0.11,
  0.08,
  0.061,
  0.044,
  0.035,
  0.031,
  0.026,
  0.024, // 10
];

export function typicalClickRate(rank: number) {
  if (!Number.isFinite(rank) || rank <= 0) return CTR_BY_RANK[10];
  if (rank <= 1) return CTR_BY_RANK[1];
  if (rank >= 20) return 0.005;
  const low = Math.floor(rank);
  const high = Math.min(low + 1, 20);
  const frac = rank - low;
  const a = rateAt(low);
  const b = rateAt(high);
  return a + (b - a) * frac;
}

function rateAt(rank: number) {
  if (rank <= 10) return CTR_BY_RANK[rank];
  return CTR_BY_RANK[10] * (10 / rank);
}

export type BenchmarkTone = "better" | "typical" | "below";

export function compareClickRate(actual: number, rank: number) {
  const typical = typicalClickRate(rank);
  const ratio = typical > 0 ? actual / typical : 1;
  const tone: BenchmarkTone =
    ratio >= 1.15 ? "better" : ratio <= 0.85 ? "below" : "typical";
  return { typical, ratio, tone };
}
