import { Tracker, type Hand } from "./tracker";
import { classify, dist, LABEL, type G, type P } from "./gestures";
import { Board, type Stroke } from "./board";

export const COLORS = ["#00f5d4", "#fee440", "#f15bb5", "#9b5de5", "#ffffff", "#ff595e"];

const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

interface HS { enterPending?: boolean; g: G; cand: G; n: number; cur: P; stroke: Stroke | null; grab: Stroke | null; last: P; size: number }
interface Vis { id: string; pts: P[]; hs: HS }
interface Pinch { mode: number; s: Stroke | null; base: P[]; c: P; m0: number; m: number }

const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function drawStrokes(c: CanvasRenderingContext2D, strokes: Stroke[]): void {
  c.lineCap = "round"; c.lineJoin = "round";
  for (const s of strokes) {
    c.strokeStyle = s.color; c.fillStyle = s.color; c.lineWidth = s.width;
    c.shadowColor = s.color; c.shadowBlur = 14;
    const p = s.pts;
    if (p.length === 1) { c.beginPath(); c.arc(p[0].x, p[0].y, s.width / 2, 0, 7); c.fill(); continue; }
    c.beginPath(); c.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length - 1; i++) {
      c.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
    }
    c.lineTo(p[p.length - 1].x, p[p.length - 1].y);
    c.stroke();
  }
  c.shadowBlur = 0;
}

export class App {
  readonly board = new Board();
  color = COLORS[0];
  width = 6;
  private video = document.getElementById("cam") as HTMLVideoElement;
  private cv = document.getElementById("fx") as HTMLCanvasElement;
  private ctx = this.cv.getContext("2d")!;
  private statusEl = document.getElementById("status")!;
  private tracker!: Tracker;
  private hs = new Map<string, HS>();
  private vis: Vis[] = [];
  private pz: Pinch | null = null;
  private W = 0; private H = 0; private dpr = 1;
  private lastLabel = "";

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();
    addEventListener("resize", () => this.resize());
    this.resize();
    this.tracker = await Tracker.create();
    const loop = () => {
      const hands = this.video.readyState >= 2 ? this.tracker.detect(this.video) : null;
      if (hands) this.update(hands);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private resize(): void {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.W = innerWidth; this.H = innerHeight;
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
  }

  private cover(): { sc: number; ox: number; oy: number; vw: number; vh: number } {
    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    const sc = Math.max(this.W / vw, this.H / vh);
    return { sc, vw, vh, ox: (this.W - vw * sc) / 2, oy: (this.H - vh * sc) / 2 };
  }
  private map(p: P): P {
    const { sc, vw, vh, ox, oy } = this.cover();
    return { x: this.W - (p.x * vw * sc + ox), y: p.y * vh * sc + oy };
  }

  private update(hands: Hand[]): void {
    const aspect = this.video.videoWidth / this.video.videoHeight;
    const seen = new Set<string>();
    this.vis = [];
    for (const h of hands) {
      seen.add(h.id);
      const pts = h.lm.map((p) => this.map(p));
      const palm = this.board.centroid([pts[0], pts[5], pts[9], pts[13], pts[17]]);
      let s = this.hs.get(h.id);
      if (!s) { s = { g: "none", cand: "none", n: 0, cur: palm, stroke: null, grab: null, last: palm, size: 0 }; this.hs.set(h.id, s); }

      const g = classify(h.lm, aspect);
      if (g === s.g) { s.cand = g; s.n = 0; }
      else if (g === s.cand) { if (++s.n >= 3) { this.leave(s); s.g = g; s.n = 0; s.enterPending = true; } }
      else { s.cand = g; s.n = 1; }

      s.size = dist(pts[0], pts[9]);
      const raw = s.g === "point" ? pts[8] : s.g === "pinch" ? lerp(pts[4], pts[8], 0.5) : palm;
      s.cur = lerp(s.cur, raw, s.g === "point" ? 0.55 : 0.4);
      if (s.enterPending) { s.enterPending = false; this.enter(s); }
      this.act(s);
      this.vis.push({ id: h.id, pts, hs: s });
    }
    for (const [id, s] of this.hs) if (!seen.has(id)) { this.leave(s); this.hs.delete(id); }
    this.updatePinch();
    this.setStatus();
  }

  private enter(s: HS): void {
    s.last = s.cur;
    if (s.g === "point") { this.board.snapshot(); s.stroke = this.board.begin(this.color, this.width, s.cur); }
    else if (s.g === "fist") { this.board.snapshot(); s.grab = this.board.nearest(s.cur, 0.25 * Math.min(this.W, this.H)); }
    else if (s.g === "palm") this.board.snapshot();
  }
  private leave(s: HS): void {
    if (s.stroke) this.board.finish(s.stroke);
    s.stroke = null; s.grab = null;
  }
  private act(s: HS): void {
    if (s.g === "point" && s.stroke) {
      const l = s.stroke.pts[s.stroke.pts.length - 1];
      if (dist(l, s.cur) > 3) s.stroke.pts.push({ ...s.cur });
    } else if (s.g === "fist" && s.grab) {
      this.board.translate(s.grab, s.cur.x - s.last.x, s.cur.y - s.last.y);
      s.last = s.cur;
    } else if (s.g === "palm") this.board.erase(s.cur, s.size * 1.1);
  }

  /** 🤏: bitta qo'l — qo'l kameraga yaqinlashsa kattalashadi; ikki qo'l — oralig'iga qarab. */
  private updatePinch(): void {
    const ps = this.vis.filter((v) => v.hs.g === "pinch");
    if (!ps.length) { this.pz = null; return; }
    const mode = ps.length >= 2 ? 2 : 1;
    const cur = mode === 2 ? lerp(ps[0].hs.cur, ps[1].hs.cur, 0.5) : ps[0].hs.cur;
    const metric = mode === 2 ? dist(ps[0].hs.cur, ps[1].hs.cur) : ps[0].hs.size;
    if (!this.pz || this.pz.mode !== mode) {
      this.board.snapshot();
      const st = this.board.nearest(cur, 0.3 * Math.min(this.W, this.H));
      this.pz = { mode, s: st, base: st ? st.pts.map((p) => ({ ...p })) : [], c: st ? this.board.centroid(st.pts) : cur, m0: metric, m: metric };
      return;
    }
    this.pz.m += (metric - this.pz.m) * 0.35;
    if (this.pz.s) {
      const k = Math.min(6, Math.max(0.25, this.pz.m / this.pz.m0));
      this.board.scaleFrom(this.pz.s, this.pz.base, this.pz.c, k);
    }
  }

  private setStatus(): void {
    const label = this.vis.length ? this.vis.map((v) => LABEL[v.hs.g]).join("  +  ") : "Qo'lingizni kameraga ko'rsating";
    if (label === this.lastLabel) return;
    this.lastLabel = label;
    this.statusEl.textContent = label;
    this.statusEl.classList.remove("pulse"); void this.statusEl.offsetWidth; this.statusEl.classList.add("pulse");
  }

  private render(): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    drawStrokes(c, this.board.strokes);

    const active = new Set<Stroke>();
    for (const v of this.vis) if (v.hs.grab) active.add(v.hs.grab);
    if (this.pz?.s) active.add(this.pz.s);
    c.setLineDash([6, 6]); c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 1.5;
    for (const s of active) {
      const xs = s.pts.map((p) => p.x), ys = s.pts.map((p) => p.y), pad = s.width + 10;
      c.strokeRect(Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2);
    }
    c.setLineDash([]);

    for (const v of this.vis) {
      c.strokeStyle = "rgba(255,255,255,.28)"; c.lineWidth = 2; c.beginPath();
      for (const [a, b] of BONES) { c.moveTo(v.pts[a].x, v.pts[a].y); c.lineTo(v.pts[b].x, v.pts[b].y); }
      c.stroke();
      const s = v.hs;
      c.lineWidth = 3;
      if (s.g === "palm") {
        c.strokeStyle = "#ff595e"; c.fillStyle = "rgba(255,89,94,.14)";
        c.beginPath(); c.arc(s.cur.x, s.cur.y, s.size * 1.1, 0, 7); c.fill(); c.stroke();
      } else if (s.g === "point") {
        c.fillStyle = this.color; c.beginPath(); c.arc(s.cur.x, s.cur.y, this.width / 2 + 5, 0, 7); c.fill();
      } else if (s.g === "none") {
        c.fillStyle = "rgba(255,255,255,.5)"; c.beginPath(); c.arc(v.pts[8].x, v.pts[8].y, 5, 0, 7); c.fill();
      } else {
        c.strokeStyle = s.g === "fist" ? "#fee440" : "#00f5d4";
        c.beginPath(); c.arc(s.cur.x, s.cur.y, 22, 0, 7); c.stroke();
      }
    }
  }

  undo(): void { this.board.undo(); }
  clear(): void { this.board.clear(); }

  save(): void {
    const o = document.createElement("canvas");
    o.width = this.W * this.dpr; o.height = this.H * this.dpr;
    const c = o.getContext("2d")!;
    c.scale(this.dpr, this.dpr);
    const { sc, vw, vh, ox, oy } = this.cover();
    c.save(); c.translate(this.W, 0); c.scale(-1, 1); c.drawImage(this.video, ox, oy, vw * sc, vh * sc); c.restore();
    drawStrokes(c, this.board.strokes);
    const a = document.createElement("a");
    a.href = o.toDataURL("image/png"); a.download = `airdraw-${Date.now()}.png`; a.click();
  }
}
