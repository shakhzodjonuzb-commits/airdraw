import type { P } from "./gestures";
import { dist } from "./gestures";

export interface Stroke { id: number; color: string; width: number; pts: P[] }

export class Board {
  strokes: Stroke[] = [];
  private nextId = 1;
  private hist: string[] = [];

  begin(color: string, width: number, p: P): Stroke {
    const s: Stroke = { id: this.nextId++, color, width, pts: [{ ...p }] };
    this.strokes.push(s);
    return s;
  }
  /** Juda qisqa (tasodifiy) chiziqni olib tashlaydi. */
  finish(s: Stroke): void {
    if (s.pts.length < 3) this.strokes = this.strokes.filter((x) => x !== s);
  }
  snapshot(): void {
    const j = JSON.stringify(this.strokes);
    if (this.hist[this.hist.length - 1] === j) return;
    this.hist.push(j);
    if (this.hist.length > 40) this.hist.shift();
  }
  undo(): void {
    const j = this.hist.pop();
    if (j !== undefined) this.strokes = JSON.parse(j) as Stroke[];
  }
  clear(): void { this.snapshot(); this.strokes = []; }

  nearest(p: P, max: number): Stroke | null {
    let best: Stroke | null = null, bd = max;
    for (const s of this.strokes) for (const q of s.pts) {
      const d = dist(p, q);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  translate(s: Stroke, dx: number, dy: number): void {
    for (const p of s.pts) { p.x += dx; p.y += dy; }
  }
  centroid(pts: P[]): P {
    const c = { x: 0, y: 0 };
    for (const p of pts) { c.x += p.x; c.y += p.y; }
    return { x: c.x / pts.length, y: c.y / pts.length };
  }
  scaleFrom(s: Stroke, base: P[], c: P, k: number): void {
    s.pts = base.map((p) => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }));
  }
  erase(c: P, r: number): void {
    const out: Stroke[] = [];
    for (const s of this.strokes) {
      let run: P[] = [], cut = false;
      const flush = () => {
        if (run.length >= 2) out.push({ id: cut ? this.nextId++ : s.id, color: s.color, width: s.width, pts: run });
        run = [];
      };
      for (const p of s.pts) {
        if (dist(p, c) > r) run.push(p); else { cut = true; flush(); }
      }
      flush();
    }
    this.strokes = out;
  }
}
