// MNIST-like preprocessing: grayscale → invert (if needed) → threshold bbox → resize longest side to 20
// → pad to 28x28 → (optional) small blur → center-of-mass recenter.
export type ProcessOpts = { threshold?: number; blur?: number };
const W = 28, H = 28, TARGET = 20;

function toGrayscale(data: Uint8ClampedArray): Uint8ClampedArray {
  // input RGBA -> output grayscale array (0..255)
  const n = data.length / 4;
  const g = new Uint8ClampedArray(n);
  for (let i=0, j=0; i<data.length; i+=4, j++) {
    const r=data[i], g1=data[i+1], b=data[i+2];
    g[j] = (0.299*r + 0.587*g1 + 0.114*b) | 0;
  }
  return g;
}

function invertIfWhiteBackground(g: Uint8ClampedArray): Uint8ClampedArray {
  let sum=0;
  for (let i=0;i<g.length;i++) sum += g[i];
  const mean = sum / g.length;
  if (mean > 127) {
    for (let i=0;i<g.length;i++) g[i] = 255 - g[i];
  }
  return g;
}

function bbox(mask: Uint8Array, width: number, height: number) {
  let minx=width, miny=height, maxx=-1, maxy=-1;
  for (let y=0;y<height;y++){
    for (let x=0;x<width;x++){
      const v = mask[y*width + x];
      if (v){
        if (x<minx) minx=x;
        if (y<miny) miny=y;
        if (x>maxx) maxx=x;
        if (y>maxy) maxy=y;
      }
    }
  }
  if (maxx < 0) return null;
  // add tiny margin
  minx = Math.max(0, minx-2); miny = Math.max(0, miny-2);
  maxx = Math.min(width-1, maxx+2); maxy = Math.min(height-1, maxy+2);
  return {x:minx, y:miny, w:maxx-minx+1, h:maxy-miny+1};
}

function centerOfMassShift(img28: Uint8ClampedArray) {
  // img28 is 28*28 grayscale (0..255); return integer dx,dy to center mass
  let sum=0, cx=0, cy=0;
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const v = img28[y*W+x];
      sum += v; cx += x*v; cy += y*v;
    }
  }
  if (sum === 0) return {dx:0, dy:0};
  cx /= sum; cy /= sum;
  const dx = Math.round(W/2 - cx);
  const dy = Math.round(H/2 - cy);
  return {dx, dy};
}

export function preprocessTo28x28(
  src: HTMLCanvasElement, // the user drawing canvas
  opts: ProcessOpts = {}
): {tensor: Float32Array, preview: ImageData} {
  const {threshold=10, blur=0.5} = opts;

  // 1) read pixels
  const sw = src.width, sh = src.height;
  const sctx = src.getContext("2d", {willReadFrequently:true})!;
  const rgba = sctx.getImageData(0,0,sw,sh);
  let g = toGrayscale(rgba.data);
  g = invertIfWhiteBackground(g);

  // 2) normalize 0..255 and threshold -> mask
  let min=255, max=0;
  for (let i=0;i<g.length;i++){ if (g[i]<min) min=g[i]; if (g[i]>max) max=g[i]; }
  const norm = new Uint8ClampedArray(g.length);
  const span = Math.max(1, max - min);
  for (let i=0;i<g.length;i++) norm[i] = ((g[i]-min)*255/span) | 0;

  const mask = new Uint8Array(norm.length);
  for (let i=0;i<norm.length;i++) mask[i] = norm[i] > threshold ? 1 : 0;

  // 3) crop to bbox
  const bb = bbox(mask, sw, sh);
  const crop = document.createElement("canvas");
  let cw = sw, ch = sh, sx=0, sy=0;
  if (bb){
    cw = bb.w; ch = bb.h; sx = bb.x; sy = bb.y;
  }
  crop.width = cw; crop.height = ch;
  crop.getContext("2d")!.putImageData(
    new ImageData(
      // rebuild RGBA from grayscale (opaque)
      Uint8ClampedArray.from({length: cw*ch*4}, (_,i)=>{
        if ((i&3)===3) return 255;
        const x = i>>2;
        const gx = norm[(sy + Math.floor(x/cw))*sw + (sx + (x%cw))];
        return gx;
      }),
      cw, ch
    ),
    0, 0
  );

  // 4) resize longest side to 20
  const scale = TARGET / Math.max(cw, ch);
  const rw = Math.max(1, Math.round(cw*scale));
  const rh = Math.max(1, Math.round(ch*scale));
  const resized = document.createElement("canvas"); resized.width=rw; resized.height=rh;
  resized.getContext("2d")!.imageSmoothingEnabled = true;
  resized.getContext("2d")!.drawImage(crop, 0, 0, rw, rh);

  // 5) paste into 28x28 center
  const c28 = document.createElement("canvas"); c28.width=W; c28.height=H;
  const cctx = c28.getContext("2d")!;
  cctx.fillStyle="black"; cctx.fillRect(0,0,W,H);
  const left = Math.floor((W - rw)/2), top = Math.floor((H - rh)/2);
  cctx.drawImage(resized, left, top);

  // optional tiny blur (box blur approx)
  if (blur && blur>0) {
    cctx.filter = `blur(${blur}px)`; // visual blur; good enough for MNIST
    cctx.drawImage(c28, 0, 0);
    cctx.filter = "none";
  }

  // 6) center-of-mass recenter
  const id = cctx.getImageData(0,0,W,H);
  // compute shift on grayscale
  const gray28 = new Uint8ClampedArray(W*H);
  for (let i=0, j=0; i<id.data.length; i+=4, j++) gray28[j] = id.data[i]; // R channel
  const {dx, dy} = centerOfMassShift(gray28);
  if (dx!==0 || dy!==0) {
    const tmp = document.createElement("canvas"); tmp.width=W; tmp.height=H;
    tmp.getContext("2d")!.putImageData(id, 0, 0);
    cctx.clearRect(0,0,W,H);
    cctx.drawImage(tmp, dx, dy);
  }

  // 7) final tensor HWC -> NCHW float32 normalized like training
  const out = cctx.getImageData(0,0,W,H);
  const x = new Float32Array(1*1*H*W);
  const mean = 0.1307, std = 0.3081;
  for (let i=0, j=0; i<out.data.length; i+=4, j++) {
    const v = out.data[i]/255;           // 0..1
    x[j] = (v - mean) / std;            // normalize
  }
  return { tensor: x, preview: out };
}
