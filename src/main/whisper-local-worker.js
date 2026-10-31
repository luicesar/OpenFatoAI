'use strict';

const { parentPort } = require('worker_threads');
const path = require('path');

let transcriber = null;

const MODEL_ID = 'Xenova/whisper-base';

// Resolve o diretório dist/ do @xenova/transformers para localizar os arquivos WASM.
// __dirname → src/main/ (dev) ou .../resources/app.asar/src/main/ (build empacotada).
// Em build empacotada, @xenova/transformers fica fora do .asar (asarUnpack), então
// se __dirname estiver dentro de "app.asar", reescrevemos para "app.asar.unpacked".
function resolveWasmDir() {
  let base = path.join(__dirname, '..', '..', 'node_modules', '@xenova', 'transformers', 'dist');

  if (base.includes(`.asar${path.sep}`) || base.endsWith('.asar')) {
    base = base.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
  }

  return base + path.sep;
}

const wasmDir = resolveWasmDir();

async function loadModel() {
  if (transcriber) return;

  // @xenova/transformers é ESM-only — import() dinâmico funciona em worker_threads
  // (diferente de Web Workers do Electron sob file://, onde falha)
  const { pipeline, env } = await import('@xenova/transformers');

  env.backends.onnx.wasm.wasmPaths = wasmDir;
  env.backends.onnx.wasm.numThreads = 1; // single-threaded — evita requisitos de SharedArrayBuffer/COEP
  env.allowLocalModels  = true;
  env.allowRemoteModels = true; // baixa o modelo na primeira execução, depois usa cache local

  parentPort.postMessage({ type: 'status', status: 'loading' });

  transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
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

  parentPort.postMessage({ type: 'status', status: 'ready' });
}

parentPort.on('message', async (msg) => {
  const { type, id } = msg;

  if (type === 'load') {
    try {
      await loadModel();
      parentPort.postMessage({ type: 'load-result', id, ok: true });
    } catch (err) {
      parentPort.postMessage({ type: 'load-result', id, ok: false, error: err.message });
    }
    return;
  }

  if (type === 'transcribe') {
    const { audioData, language } = msg; // audioData: Float32Array (transferido via structured clone)
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
