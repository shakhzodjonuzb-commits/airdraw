import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { P } from "./gestures";

export interface Hand { id: string; lm: P[] }

const REMOTE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

async function pickModel(): Promise<string> {
  const local = `${import.meta.env.BASE_URL}models/hand_landmarker.task`;
  try {
    const r = await fetch(local, { method: "HEAD" });
    if (r.ok && !(r.headers.get("content-type") ?? "").includes("html")) return local;
  } catch { /* ignore */ }
  return REMOTE_MODEL;
}

export class Tracker {
  private lastVT = -1;
  private lastTs = 0;
  private constructor(private lm: HandLandmarker) {}

  static async create(): Promise<Tracker> {
    const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
    const modelAssetPath = await pickModel();
    const make = (delegate: "GPU" | "CPU") =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
    try { return new Tracker(await make("GPU")); }
    catch { return new Tracker(await make("CPU")); }
  }

  /** Yangi kadr bo'lmasa null qaytaradi. */
  detect(video: HTMLVideoElement): Hand[] | null {
    if (video.currentTime === this.lastVT) return null;
    this.lastVT = video.currentTime;
    this.lastTs = Math.max(performance.now(), this.lastTs + 1);
    const res = this.lm.detectForVideo(video, this.lastTs);
    const used = new Set<string>();
    return res.landmarks.map((lm, i) => {
      let id = res.handedness[i]?.[0]?.categoryName ?? `H${i}`;
      if (used.has(id)) id += i;
      used.add(id);
      return { id, lm };
    });
  }
}
