export interface P { x: number; y: number }
export type G = "point" | "fist" | "pinch" | "palm" | "none";

export const dist = (a: P, b: P): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Landmarklar normallashgan (0..1) — aspect bilan to'g'rilab masofa o'lchaymiz. */
export function classify(lm: P[], aspect: number): G {
  const d = (a: number, b: number) => Math.hypot((lm[a].x - lm[b].x) * aspect, lm[a].y - lm[b].y);
  const size = d(0, 9);
  if (size < 1e-4) return "none";
  const r = (tip: number, mcp: number) => d(0, tip) / d(0, mcp);
  const i = r(8, 5), m = r(12, 9), rg = r(16, 13), p = r(20, 17);
  const pinch = d(4, 8) / size;

  if (pinch < 0.32 && i > 1.25) return "pinch";
  if (i > 1.6 && m > 1.6 && rg > 1.5 && p > 1.4) return "palm";
  if (i > 1.6 && m < 1.45 && rg < 1.45 && p < 1.5) return "point";
  if (i < 1.4 && m < 1.4 && rg < 1.4 && p < 1.5) return "fist";
  return "none";
}

export const LABEL: Record<G, string> = {
  point: "👆 Chizish", fist: "✊ Surish", pinch: "🤏 Kattalashtirish",
  palm: "✋ O‘chirish", none: "🖐 Ishora kutilmoqda",
};
