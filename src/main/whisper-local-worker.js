'use strict';

// Runs as a child process started with ELECTRON_RUN_AS_NODE=1 (see ipc/whisper.js): loading
// onnxruntime-node models of ~150 MB+ crashes Electron's regular mode with SIGTRAP, but works
// in Node mode. Messages travel over the fork IPC channel (JSON; audio as base64).
const parentPort = {
  postMessage: (m) => process.send(m),
  on: (event, cb) => process.on(event, cb),
};
const path = require('path');
const fs   = require('fs');

let transcriber = null;
let parakeet    = null; // sherpa-onnx OfflineRecognizer when the Parakeet profile is loaded

const MODEL_ID = 'Xenova/whisper-base';

let loadedModelId = null;

// ── Parakeet (sherpa-onnx) ───────────────────────────────────────
const PARAKEET_PREFIX = 'parakeet-';
const PARAKEET_REPO   = 'https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/main';
const PARAKEET_FILES  = ['tokens.txt', 'decoder.int8.onnx', 'joiner.int8.onnx', 'encoder.int8.onnx'];
const PARAKEET_THREADS = 4;

const isParakeet = (modelId) => String(modelId).startsWith(PARAKEET_PREFIX);

/** Downloads the model files once into <cacheDir>/<modelId>/, reporting overall progress. */
async function ensureParakeetFiles(modelId) {
  const dir = path.join(process.env.WHISPER_CACHE_DIR || path.join(__dirname, '..', '..', '.cache'), modelId);
  fs.mkdirSync(dir, { recursive: true });

  const missing = PARAKEET_FILES.filter((f) => !fs.existsSync(path.join(dir, f)));
  if (missing.length === 0) return dir;

  parentPort.postMessage({ type: 'status', status: 'loading' });
  const sizes = await Promise.all(missing.map(async (f) => {
    const res = await fetch(`${PARAKEET_REPO}/${f}`, { method: 'HEAD', redirect: 'follow' });
    if (!res.ok) throw new Error(`Parakeet download failed (${f}): HTTP ${res.status}`);
    return Number(res.headers.get('content-length')) || 0;
  }));
  const total = sizes.reduce((a, b) => a + b, 0);
  let done = 0;
  let lastPct = -1;

  for (const f of missing) {
    const res = await fetch(`${PARAKEET_REPO}/${f}`, { redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error(`Parakeet download failed (${f}): HTTP ${res.status}`);
    const part = path.join(dir, `${f}.part`);
    const out  = fs.createWriteStream(part);
    for await (const chunk of res.body) {
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      done += chunk.length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      if (pct !== lastPct) {
        lastPct = pct;
        parentPort.postMessage({ type: 'progress', status: 'downloading', file: f, progress: pct });
      }
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
    fs.renameSync(part, path.join(dir, f)); // only complete files count as cached
  }
  return dir;
}

async function loadParakeet(modelId) {
  const dir = await ensureParakeetFiles(modelId);
  const sherpa = require('sherpa-onnx-node');
  parentPort.postMessage({ type: 'status', status: 'loading' });
  parakeet = new sherpa.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: path.join(dir, 'encoder.int8.onnx'),
        decoder: path.join(dir, 'decoder.int8.onnx'),
        joiner : path.join(dir, 'joiner.int8.onnx'),
      },
      tokens: path.join(dir, 'tokens.txt'),
      numThreads: PARAKEET_THREADS,
      provider: 'cpu',
      debug: 0,
      modelType: 'nemo_transducer',
    },
  });
}

function transcribeParakeet(audioData) {
  const stream = parakeet.createStream();
  stream.acceptWaveform({ sampleRate: 16000, samples: audioData });
  parakeet.decode(stream);
  return (parakeet.getResult(stream).text || '').trim();
}

async function loadModel(modelId = MODEL_ID) {
  if ((transcriber || parakeet) && loadedModelId === modelId) return;
  transcriber = null;
  parakeet = null;

  if (isParakeet(modelId)) {
    await loadParakeet(modelId);
    loadedModelId = modelId;
    parentPort.postMessage({ type: 'status', status: 'ready' });
    return;
  }

  // @huggingface/transformers é ESM-only — import() dinâmico funciona em worker_threads
  // (diferente de Web Workers do Electron sob file://, onde falha)
  const { pipeline, env } = await import('@huggingface/transformers');

  if (process.env.WHISPER_CACHE_DIR) env.cacheDir = process.env.WHISPER_CACHE_DIR;
  env.allowLocalModels  = true;
  env.allowRemoteModels = true; // baixa o modelo na primeira execução, depois usa cache local

  parentPort.postMessage({ type: 'status', status: 'loading' });

  transcriber = await pipeline('automatic-speech-recognition', modelId, {
    device: 'cpu',
    dtype: 'q8', // pesos quantizados (arquivos *_quantized.onnx)
    progress_callback: (p) => {
      if (p.status === 'progress') {
        parentPort.postMessage({
          type: 'progress',
          status: 'downloading',
          file: p.file,
          progress: Math.round(p.progress ?? 0),
        });
      }
    },
  });

  loadedModelId = modelId;
  parentPort.postMessage({ type: 'status', status: 'ready' });
}

parentPort.on('message', async (msg) => {
  const { type, id } = msg;

  if (type === 'load') {
    try {
      await loadModel(msg.modelId || MODEL_ID);
      parentPort.postMessage({ type: 'load-result', id, ok: true });
    } catch (err) {
      parentPort.postMessage({ type: 'load-result', id, ok: false, error: err.message });
    }
    return;
  }

  if (type === 'transcribe') {
    const { audioB64, language } = msg; // float32 bruto em base64 (canal IPC JSON)
    const raw = Buffer.from(audioB64, 'base64');
    const audioData = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
    try {
      if (!transcriber && !parakeet) await loadModel();

      // Parakeet detects the language by itself (25 European languages, Portuguese included)
      if (parakeet) {
        parentPort.postMessage({ type: 'transcribe-result', id, ok: true, text: transcribeParakeet(audioData) });
        return;
      }

      // Mapeamento de language (ver seção 3 do contrato)
      const xenovaLanguage = (language === 'pt-BR' || language === 'pt') ? 'portuguese' : 'english';

      const result = await transcriber(audioData, {
        language: xenovaLanguage,
        task: 'transcribe',
        return_timestamps: false,
        no_repeat_ngram_size: 3,  // evita repetição do mesmo trigrama
        repetition_penalty: 1.3,  // penaliza tokens já gerados
      });

      const text = (result.text || '').trim();
      parentPort.postMessage({ type: 'transcribe-result', id, ok: true, text });
    } catch (err) {
      parentPort.postMessage({ type: 'transcribe-result', id, ok: false, error: err.message });
    }
    return;
  }
});
