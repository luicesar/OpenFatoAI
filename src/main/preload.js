'use strict';

// ── Preload: secure bridge between main and renderer ─────────────
// Exposes a minimal, explicit API surface via contextBridge.
// NEVER expose ipcRenderer, require, or process.env directly.

const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

// Expose only the env vars the renderer actually needs
const env = {
  GEMINI_API_URL: process.env.GEMINI_API_URL || '',
};

contextBridge.exposeInMainWorld('electronAPI', {
  env,

  // ── Config ──────────────────────────────────────────────────
  saveConfig : (cfg)  => ipcRenderer.invoke('save-config', cfg),
  loadConfig : ()     => ipcRenderer.invoke('load-config'),

  // ── API Key ──────────────────────────────────────────────────
  saveApiKey    : (key) => ipcRenderer.invoke('save-api-key', key),
  hasApiKey     : ()    => ipcRenderer.invoke('has-api-key'),
  openApiKeyUrl : ()    => ipcRenderer.invoke('open-api-key-url'),

  // ── OpenAI Key ───────────────────────────────────────────────
  saveOpenAIKey    : (key) => ipcRenderer.invoke('save-openai-key', key),
  hasOpenAIKey     : ()    => ipcRenderer.invoke('has-openai-key'),
  openOpenAIKeyUrl : ()    => ipcRenderer.invoke('open-openai-key-url'),

  // ── Anthropic Key ────────────────────────────────────────────
  saveAnthropicKey    : (key) => ipcRenderer.invoke('save-anthropic-key', key),
  hasAnthropicKey     : ()    => ipcRenderer.invoke('has-anthropic-key'),
  openAnthropicKeyUrl : ()    => ipcRenderer.invoke('open-anthropic-key-url'),

  // ── Window ───────────────────────────────────────────────────
  hideWindow           : () => ipcRenderer.invoke('hide-window'),

  // ── Hardware ─────────────────────────────────────────────────────

  // ── Window controls ───────────────────────────────────────────────
  windowMinimize:       () => ipcRenderer.invoke('window:minimize'),
  windowMaximizeToggle: () => ipcRenderer.invoke('window:maximize-toggle'),
  windowClose:          () => ipcRenderer.invoke('window:close'),
  windowQuit:           () => ipcRenderer.invoke('window:quit'),
  getAppVersion:        () => ipcRenderer.invoke('get-app-version'),

  // ── AI ───────────────────────────────────────────────────────
  sendAudio      : (obj) => ipcRenderer.invoke('send-audio',      obj),
  sendScreenshot : (obj) => ipcRenderer.invoke('send-screenshot',  obj),
  sendText       : (obj) => ipcRenderer.invoke('send-text',        obj),

  // ── Screen capture ───────────────────────────────────────────
  captureScreenDesktop : () => ipcRenderer.invoke('capture-screen-desktop'),

  captureAndOcr: () =>
    // Returns an async function that accepts a placeholders array.
    // This two-step pattern keeps the preload API clean.
    async function captureAndOcr(placeholders = []) {
      return ipcRenderer.invoke('capture-and-ocr', placeholders);
    },

  captureRegionAndOcr: (placeholders = []) =>
    ipcRenderer.invoke('capture-region-and-ocr', placeholders),

  // ── Vosk model ───────────────────────────────────────────────
  readModelFile: (filename) => ipcRenderer.invoke('read-model-file', filename),

  // ── Diarization (Python resemblyzer microservice) ────────────
  diarizationReset: () => ipcRenderer.invoke('diarization-reset'),
  // Pass Float32Array directly (structured-clone binary transfer).
  diarizeChunk: (audioData, chunkId) =>
    ipcRenderer.invoke('diarize-chunk', { audioData, chunkId, sampleRate: 16000 }),

  // ── Whisper transcription (main-process inference) ───────────
  whisperLoad: () => ipcRenderer.invoke('whisper-load'),
  // Pass Float32Array directly (structured-clone binary transfer) instead of
  // Array.from() which would serialize millions of floats as a slow JSON-like array,
  // blocking the renderer event loop and triggering the "not responding" dialog.
  whisperTranscribe: (audioData, language) =>
    ipcRenderer.invoke('whisper-transcribe', { audioData, language }),
  onWhisperProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('whisper-progress', handler);
    return () => ipcRenderer.removeListener('whisper-progress', handler);
  },

  // ── Optional sync (Settings → Sync) ─────────────────────────────
  syncGetConfig:       ()                            => ipcRenderer.invoke('sync:get-config'),
  syncSetConfig:       (serverUrl)                   => ipcRenderer.invoke('sync:set-config', { serverUrl }),
  syncTest:            (serverUrl)                   => ipcRenderer.invoke('sync:test', { serverUrl }),
  syncPushAll:         ()                            => ipcRenderer.invoke('sync:push-all'),

  // ── Update notification ──────────────────────────────────────
  updateCheck: () => ipcRenderer.invoke('update:check'),
  onUpdateAvailable: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('update:available', handler);
    return () => ipcRenderer.removeListener('update:available', handler);
  },
  shellOpenExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // ── Transcriptions CRUD ──────────────────────────────────────
  saveTranscription:   (data)       => ipcRenderer.invoke('save-transcription',   data),
  listTranscriptions:  (opts)       => ipcRenderer.invoke('list-transcriptions',  opts),
  getTranscription:    (id)         => ipcRenderer.invoke('get-transcription',    id),
  updateTranscription: (id, data)   => ipcRenderer.invoke('update-transcription', id, data),
  deleteTranscription: (id)         => ipcRenderer.invoke('delete-transcription', id),

  // Legacy: full-screen thumbnail via desktopCapturer (stays in preload because
  // desktopCapturer is only available in the preload context).
  captureScreenThumbnail: async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types        : ['screen', 'window'],
        thumbnailSize: { width: 1280, height: 720 },
      });
      if (sources?.length) return { ok: true, dataUrl: sources[0].thumbnail.toDataURL() };
      return { ok: false, error: 'no-sources-returned' };
    } catch (e) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  },
});
