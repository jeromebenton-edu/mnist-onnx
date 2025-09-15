import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
const ortDistDir = join(process.cwd(), "node_modules", "onnxruntime-web", "dist");
const ortPublicDir = join(process.cwd(), "public", "ort");
const ortAssets = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd.wasm",
  "ort-wasm-threaded.wasm",
  "ort-wasm.wasm",
];

if (!existsSync(ortPublicDir)) {
  mkdirSync(ortPublicDir, { recursive: true });
}

let copied = 0;

for (const asset of ortAssets) {
  const source = join(ortDistDir, asset);
  if (!existsSync(source)) {
    continue;
  }
  const target = join(ortPublicDir, asset);
  const shouldCopy =
    !existsSync(target) || statSync(source).mtimeMs > statSync(target).mtimeMs;
  if (shouldCopy) {
    copyFileSync(source, target);
    copied += 1;
  }
}

if (copied > 0) {
  console.log(`Copied ${copied} ONNX Runtime asset${copied === 1 ? "" : "s"}.`);
}
