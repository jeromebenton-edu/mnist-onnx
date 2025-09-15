import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // ONNX Runtime Web configuration
    if (!isServer) {
      const ortDistDir = path.join(
        path.dirname(require.resolve("onnxruntime-web/package.json")),
        "dist"
      );
      const ortPublicDir = path.join(process.cwd(), "public", "ort");
      const ortAssets = [
        "ort-wasm-simd-threaded.wasm",
        "ort-wasm-simd-threaded.mjs",
        "ort-wasm-simd-threaded.jsep.wasm",
        "ort-wasm-simd-threaded.jsep.mjs",
        "ort-wasm-simd.wasm",
        "ort-wasm-threaded.wasm",
        "ort-wasm.wasm"
      ];

      if (!fs.existsSync(ortPublicDir)) {
        fs.mkdirSync(ortPublicDir, { recursive: true });
      }

      for (const asset of ortAssets) {
        const source = path.join(ortDistDir, asset);
        const target = path.join(ortPublicDir, asset);

        if (!fs.existsSync(source)) continue;

        const shouldCopy = !fs.existsSync(target) ||
          fs.statSync(source).mtimeMs > fs.statSync(target).mtimeMs;

        if (shouldCopy) {
          fs.copyFileSync(source, target);
        }
      }

      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
