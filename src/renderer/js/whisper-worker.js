// Whisper transcription worker (ES module)
// Runs @xenova/transformers inside a dedicated Worker thread so it
// never blocks the UI. Communicates via postMessage.

import { pipeline, env } from '../../../node_modules/@xenova/transformers/dist/transformers.js';

// Resolve the dist/ directory so WASM files are found correctly
// import.meta.url  →  .../src/renderer/js/whisper-worker.js
// ../../../node_modules/@xenova/transformers/dist/  →  correct WASM location
const _distDir = new URL('../../../node_modules/@xenova/transformers/dist/', import.meta.url).href;
env.backends.onnx.wasm.wasmPaths = _distDir;

// Single-threaded: avoids SharedArrayBuffer / COEP requirements
env.backends.onnx.wasm.numThreads = 1;

// Keep WASM files local — do not try to fetch from CDN
env.allowLocalModels  = true;
env.allowRemoteModels = true; // download model on first use, then cache

let transcriber = null;
let currentModel = null;

async function loadModel(language) {
  // whisper-tiny is multilingual (74MB) and handles PT-BR well
  const modelId = 'Xenova/whisper-tiny';
  if (transcriber && currentModel === modelId) return;

  self.postMessage({ type: 'status', text: 'loading' });
  transcriber = await pipeline('automatic-speech-recognition', modelId, {
    // Progress callback so the UI can show download progress
    progress_callback: (p) => {
      if (p.status === 'progress') {
        self.postMessage({
          type: 'download_progress',
          name: p.file,
          progress: Math.round(p.progress),
        });
      }
    },
  });
  currentModel = modelId;
  self.postMessage({ type: 'status', text: 'ready' });
}

self.onmessage = async (event) => {
  const { type, audio, language, sampleRate } = event.data;

  if (type === 'load') {
    try {
      await loadModel(language);
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
    return;
  }

  if (type === 'transcribe') {
    try {
      if (!transcriber) await loadModel(language);

      // audio is a Float32Array at 16 kHz
      const result = await transcriber(audio, {
        language: language === 'pt-BR' ? 'portuguese' : 'english',
        task: 'transcribe',
        // Return timestamps so we can filter silence-only segments
        return_timestamps: false,
      });

      const text = (result.text || '').trim();
      self.postMessage({ type: 'result', text });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
    return;
  }
};
