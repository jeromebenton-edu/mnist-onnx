# MNIST ONNX Web App

A web application for handwritten digit recognition using ONNX Runtime and a CNN model trained on MNIST dataset.

## Features

- Interactive canvas for drawing digits (0-9)
- Real-time preprocessing with adjustable parameters
- ONNX model inference in the browser
- Visual preview of preprocessed input
- Confidence scores for predictions

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **ML Inference**: ONNX Runtime Web
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Getting Started

1. Clone the repository
```bash
git clone <your-repo-url>
cd mnist-onnx
```

2. Install dependencies
```bash
npm install
```

3. Add your trained ONNX model
   - Place your `mnist_cnn.onnx` file in `public/models/`

4. Run the development server (this will copy the ONNX Runtime wasm + mjs files into `public/ort/` automatically)
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

   - The app serves the ONNX Runtime assets from `/ort/`. If you upgrade `onnxruntime-web`, restart the dev server so the fresh artifacts are copied across.

## How It Works

1. **Draw**: Use the canvas to draw a digit with adjustable brush size
2. **Preprocess**: The image undergoes MNIST-style preprocessing:
   - Grayscale conversion
   - Background inversion (if needed)
   - Bounding box cropping
   - Resize to 20px (longest side)
   - Center in 28x28 canvas
   - Optional blur
   - Center-of-mass alignment
   - Normalization (mean=0.1307, std=0.3081)
3. **Predict**: ONNX model runs inference and returns probabilities
4. **Results**: Shows predicted digit with confidence percentage

## Model Requirements

Your ONNX model should:
- Accept input shape `[1, 1, 28, 28]` (batch, channels, height, width)
- Input name: `"input"`
- Output name: `"logits"`
- Return 10 logits for digits 0-9

## Preprocessing Parameters

- **Brush Size**: 8-72px for drawing
- **Threshold**: 0-50 for binarization
- **Blur**: 0-1.5px for smoothing

## Deployment

Deploy to Vercel:
```bash
npm run build
vercel --prod
```

## License

MIT
