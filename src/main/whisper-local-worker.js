'use strict';

// Runs as a child process started with ELECTRON_RUN_AS_NODE=1 (see ipc/whisper.js): loading
// onnxruntime-node models of ~150 MB+ crashes Electron's regular mode with SIGTRAP, but works
// in Node mode. Messages travel over the fork IPC channel (JSON; audio as base64).
const parentPort = {
  postMessage: (m) => process.send(m),
  on: (event, cb) => process.on(event, cb),
};
const path = require('path');

let transcriber = null;

const MODEL_ID = 'Xenova/whisper-base';

let loadedModelId = null;

async function loadModel(modelId = MODEL_ID) {
  if (transcriber && loadedModelId === modelId) return;
  transcriber = null;

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
      if (!transcriber) await loadModel();

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
