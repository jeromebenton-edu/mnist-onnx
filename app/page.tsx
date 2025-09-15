"use client";
import { useEffect, useRef, useState } from "react";
import { preprocessTo28x28 } from "@/lib/preprocess";
import { loadSession, run } from "@/lib/ort";
import type * as ort from "onnxruntime-web";
import Image from "next/image";

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushRef = useRef(28);
  const colorRef = useRef("#ef4444");
  const [brush, setBrush] = useState(28);
  const [threshold, setThreshold] = useState(10);
  const [blur, setBlur] = useState(0.6);
  const [previewSize, setPreviewSize] = useState(560);
  const [previewURL, setPreviewURL] = useState<string>("");
  const [pred, setPred] = useState<string>("–");
  const [conf, setConf] = useState<string>("–");
  const [probs, setProbs] = useState<number[] | null>(null);
  const [drawingColor, setDrawingColor] = useState("#ef4444");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [session, setSession] = useState<ort.InferenceSession | null>(null);
  const [modelStatus, setModelStatus] = useState<"loading" | "ready" | "error">("loading");
  const [predicting, setPredicting] = useState(false);

  useEffect(() => {
    loadSession()
      .then(sess => {
        setSession(sess);
        setModelStatus("ready");
      })
      .catch(() => {
        setModelStatus("error");
      });
  }, []);

  useEffect(() => {
    brushRef.current = brush;
  }, [brush]);

  useEffect(() => {
    colorRef.current = drawingColor;
  }, [drawingColor]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let drawing = false;
    const start = (e: PointerEvent) => {
      drawing = true;
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
      setHasDrawn(true);
    };
    const move = (e: PointerEvent) => {
      if (!drawing) return;
      ctx.lineWidth = brushRef.current;
      ctx.strokeStyle = colorRef.current;
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    };
    const end = () => {
      drawing = false;
    };

    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    return () => {
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
  }, []);

  async function predict() {
    if (!session || predicting) return;
    setPredicting(true);

    const canvas = canvasRef.current!;
    const { tensor, preview } = preprocessTo28x28(canvas, { threshold, blur });

    const big = document.createElement("canvas");
    big.width = previewSize;
    big.height = previewSize;
    const bctx = big.getContext("2d")!;
    const small = document.createElement("canvas");
    small.width = 28;
    small.height = 28;
    small.getContext("2d")!.putImageData(preview, 0, 0);
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(small, 0, 0, previewSize, previewSize);
    setPreviewURL(big.toDataURL());

    try {
      const { probs: outputProbs, pred: predicted } = await run(session, tensor);
      const p = outputProbs[predicted];
      setPred(String(predicted));
      setConf((p * 100).toFixed(1) + "%");
      setProbs(Array.from(outputProbs));
    } finally {
      setPredicting(false);
    }
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setPreviewURL("");
    setPred("–");
    setConf("–");
    setProbs(null);
    setHasDrawn(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-6xl space-y-6 px-4">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold">Draw a digit (0–9), then Predict</h1>
              <p className="text-gray-600">Served via ONNX Runtime in the browser.</p>
            </div>
            <span
              className={`rounded-full px-4 py-1 text-sm font-medium ${
                modelStatus === "ready"
                  ? "bg-green-100 text-green-700"
                  : modelStatus === "error"
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              {modelStatus === "ready" && "Model ready"}
              {modelStatus === "loading" && "Loading model…"}
              {modelStatus === "error" && "Model failed to load"}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-600 shadow-sm backdrop-blur">
            <p className="font-medium text-slate-700">Tips</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Use a large brush and slow strokes for smoother digits.</li>
              <li>Tweak threshold/blur to match MNIST preprocessing.</li>
              <li>The preview shows the exact tensor fed into the model.</li>
            </ul>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-medium">Canvas / Upload</h2>
            </div>
            <div className="space-y-5 px-5 py-5">
              <div className="relative rounded-lg border-2 border-dashed border-slate-300 bg-slate-100">
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={560}
                  className="h-full w-full rounded-lg bg-white"
                />
                {!hasDrawn && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-medium text-slate-500">
                    Click or touch inside the box to start drawing
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">Brush size</span>
                  <input
                    type="range"
                    min={8}
                    max={72}
                    step={2}
                    value={brush}
                    onChange={event => setBrush(parseInt(event.target.value))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{brush}px</span>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">Brush color</span>
                  <input
                    type="color"
                    value={drawingColor}
                    onChange={event => setDrawingColor(event.target.value)}
                    className="h-10 w-full cursor-pointer rounded border"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">Preprocess threshold</span>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={threshold}
                    onChange={event => setThreshold(parseInt(event.target.value))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{threshold}</span>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">Preprocess blur (σ)</span>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.1}
                    value={blur}
                    onChange={event => setBlur(parseFloat(event.target.value))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{blur.toFixed(1)}</span>
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-sm font-medium text-gray-600">Preview size (px)</span>
                  <input
                    type="range"
                    min={320}
                    max={768}
                    step={16}
                    value={previewSize}
                    onChange={event => setPreviewSize(parseInt(event.target.value))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{previewSize}px</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={predict}
                  disabled={!session || predicting}
                  className={`rounded-lg px-4 py-2 text-white shadow transition ${
                    !session || predicting
                      ? "cursor-not-allowed bg-orange-300"
                      : "bg-orange-500 hover:bg-orange-600"
                  }`}
                >
                  {predicting ? "Predicting…" : "Predict (ONNX)"}
                </button>
                <button
                  onClick={clear}
                  className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-6">
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="border-b px-5 py-4">
                <h2 className="text-lg font-medium">Model input (28×28, upscaled)</h2>
              </div>
              <div className="flex items-center justify-center bg-black px-4 py-4">
                {previewURL ? (
                  <Image
                    src={previewURL}
                    alt="preview"
                    width={previewSize}
                    height={previewSize}
                    className="rounded border border-white/20"
                    unoptimized
                  />
                ) : (
                  <div className="grid h-[320px] w-full place-items-center text-sm text-gray-400">
                    No preview yet
                  </div>
                )}
              </div>
              <div className="border-t px-5 py-4 text-lg">
                Prediction: <b>{pred}</b> <span className="text-gray-600">({conf})</span>
              </div>
            </div>

            <div className="rounded-xl border bg-white shadow-sm">
              <div className="border-b px-5 py-4">
                <h2 className="text-lg font-medium">Class probabilities</h2>
              </div>
              <div className="px-5 py-4">
                {probs ? (
                  <div className="space-y-2 text-sm">
                    {probs.map((value, digit) => {
                      const pct = Math.round(value * 1000) / 10;
                      const highlight = pred === String(digit);
                      return (
                        <div
                          key={digit}
                          className={`rounded-lg border p-3 ${
                            highlight
                              ? "border-orange-300 bg-orange-50"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-700">{digit}</span>
                            <span className="tabular-nums text-slate-600">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="mt-2 h-2 rounded bg-slate-200">
                            <div
                              className={`h-full rounded ${
                                highlight ? "bg-orange-500" : "bg-slate-400"
                              }`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Run a prediction to view probabilities.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
