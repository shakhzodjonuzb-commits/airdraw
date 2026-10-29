// Node.js: MediaPipe WASM va modelni public/ ga tayyorlaydi (Netlify build vaqtida ham ishlaydi)
import { cpSync, existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmSrc = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDst = join(root, "public/wasm");
const modelDst = join(root, "public/models/hand_landmarker.task");
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

if (existsSync(wasmSrc)) {
  mkdirSync(wasmDst, { recursive: true });
  cpSync(wasmSrc, wasmDst, { recursive: true });
  console.log(`[prepare] wasm nusxalandi (${readdirSync(wasmDst).length} fayl)`);
} else console.warn("[prepare] wasm topilmadi — avval `npm install` qiling");

if (!existsSync(modelDst)) {
  try {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(res.status);
    mkdirSync(dirname(modelDst), { recursive: true });
    writeFileSync(modelDst, Buffer.from(await res.arrayBuffer()));
    console.log("[prepare] model yuklab olindi");
  } catch (e) {
    console.warn("[prepare] model yuklanmadi, ish vaqtida CDN dan olinadi:", e.message);
  }
}
