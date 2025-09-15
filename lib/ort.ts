import * as ort from "onnxruntime-web";

export async function loadSession(modelPath = "/models/mnist_cnn.onnx") {
  // Configure ONNX Runtime for web deployment
  ort.env.wasm.wasmPaths = "/ort/";
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;

  return await ort.InferenceSession.create(modelPath, {
    executionProviders: ["wasm"]
  });
}

export async function run(session: ort.InferenceSession, x: Float32Array) {
  // x: [1,1,28,28]
  const input = new ort.Tensor("float32", x, [1,1,28,28]);
  const out = await session.run({ input });
  const logits = out["logits"].data as Float32Array;
  // softmax
  const m = Math.max(...logits);
  const exps = logits.map(v => Math.exp(v - m));
  const s = exps.reduce((a,b)=>a+b, 0);
  const probs = exps.map(v => v/s);
  const pred = probs.indexOf(Math.max(...probs));
  return { probs, pred };
}
