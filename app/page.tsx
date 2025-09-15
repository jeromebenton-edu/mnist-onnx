"use client";
import { useEffect, useRef, useState } from "react";
import { preprocessTo28x28 } from "@/lib/preprocess";
import { loadSession, run } from "@/lib/ort";
import type * as ort from "onnxruntime-web";
import Image from "next/image";

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brush, setBrush] = useState(28);
  const [threshold, setThreshold] = useState(10);
  const [blur, setBlur] = useState(0.6);
  const [previewURL, setPreviewURL] = useState<string>("");
  const [pred, setPred] = useState<string>("–");
  const [conf, setConf] = useState<string>("–");
  const [session, setSession] = useState<ort.InferenceSession | null>(null);

  useEffect(() => {
    loadSession().then(setSession);
  }, []);

  // simple drawing
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = "black"; ctx.lineCap="round"; ctx.lineJoin="round";
    let drawing=false;
    const start=(e:PointerEvent)=>{ drawing=true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); };
    const move=(e:PointerEvent)=>{ if(!drawing) return; ctx.lineWidth=brush; ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); };
    const end=()=>{ drawing=false; };
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    return ()=>{ canvas.removeEventListener("pointerdown", start); canvas.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
  }, [brush]);

  async function predict() {
    if (!session) return;

    const canvas = canvasRef.current!;
    const { tensor, preview } = preprocessTo28x28(canvas, { threshold, blur });
    // show big preview
    const big = document.createElement("canvas");
    big.width = 560; big.height = 560;
    const bctx = big.getContext("2d")!;
    const small = document.createElement("canvas");
    small.width = 28; small.height = 28;
    small.getContext("2d")!.putImageData(preview, 0, 0);
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(small, 0, 0, 560, 560);
    setPreviewURL(big.toDataURL());

    const { probs, pred } = await run(session, tensor);
    const p = probs[pred];
    setPred(String(pred));
    setConf((p*100).toFixed(1) + "%");
  }

  function clear() {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle="white"; ctx.fillRect(0,0,c.width,c.height);
    setPreviewURL(""); setPred("–"); setConf("–");
  }

  return (
    <main className="p-6 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Draw a digit (0–9)</h1>
        <canvas ref={canvasRef} width={560} height={560} className="border rounded-md shadow" />
        <div className="flex items-center gap-4">
          <label>Brush: {brush}px</label>
          <input type="range" min={8} max={72} step={2} value={brush} onChange={e=>setBrush(parseInt(e.target.value))}/>
          <label>Threshold: {threshold}</label>
          <input type="range" min={0} max={50} value={threshold} onChange={e=>setThreshold(parseInt(e.target.value))}/>
          <label>Blur: {blur.toFixed(1)}</label>
          <input type="range" min={0} max={1.5} step={0.1} value={blur} onChange={e=>setBlur(parseFloat(e.target.value))}/>
        </div>
        <div className="flex gap-3">
          <button onClick={predict} className="px-3 py-2 rounded bg-black text-white">Predict</button>
          <button onClick={clear} className="px-3 py-2 rounded border">Clear</button>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Model input (28×28, upscaled)</h2>
        {previewURL ? (
          <Image
            src={previewURL}
            alt="preview"
            width={560}
            height={560}
            className="border rounded-md shadow"
            unoptimized
          />
        ) : (
          <div className="h-[560px] border rounded-md grid place-items-center text-gray-500">no preview yet</div>
        )}
        <div className="text-lg">Prediction: <b>{pred}</b> <span className="text-gray-600">({conf})</span></div>
      </section>
    </main>
  );
}
