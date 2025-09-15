import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // ONNX Runtime Web configuration
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
  // Copy ONNX WASM files to public
  async rewrites() {
    return [
      {
        source: '/ort-wasm-simd-threaded.wasm',
        destination: '/_next/static/chunks/ort-wasm-simd-threaded.wasm'
      },
      {
        source: '/ort-wasm-simd.wasm',
        destination: '/_next/static/chunks/ort-wasm-simd.wasm'
      },
      {
        source: '/ort-wasm-threaded.wasm',
        destination: '/_next/static/chunks/ort-wasm-threaded.wasm'
      },
      {
        source: '/ort-wasm.wasm',
        destination: '/_next/static/chunks/ort-wasm.wasm'
      }
    ];
  },
};

export default nextConfig;
