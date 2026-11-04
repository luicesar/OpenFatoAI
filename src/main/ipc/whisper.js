'use strict';

// Whisper transcription — local inference via @huggingface/transformers (Xenova/whisper-base|small, chosen in Settings),
// running in a child process (Electron in Node mode), not a Web Worker.
//
// External IPC contract is preserved: { audioData: Float32Array, language } -> ok({ text }) / fail(err).

const { ipcMain, BrowserWindow, app } = require('electron');
const { fork }          = require('child_process');
const path               = require('path');
const { createLogger }  = require('../../services/logger');
const { userDataPath, readJsonSafe, ok, fail } = require('../../shared/utils');
const { FILES, WHISPER_MODELS, WHISPER_DEFAULT_PROFILE } = require('../../shared/constants');

const log = createLogger('whisper');

let _worker = null;
let _workerReady = false;
let _loadPromise = null;
let _loadedProfile = null; // profile the current worker was loaded with
let _msgCounter = 0;
const _pending = new Map(); // id -> { resolve, reject }

function _getWorker() {
  if (_worker) return _worker;

  const child = _worker = fork(path.join(__dirname, '..', 'whisper-local-worker.js'), [], {
    // Models are cached in the user's data folder: the install dir (e.g. /opt) is read-only.
    env          : { ...process.env, ELECTRON_RUN_AS_NODE: '1', WHISPER_CACHE_DIR: path.join(app.getPath('userData'), 'whisper-models') },
    execPath     : process.execPath,
    execArgv     : [],
    // default (JSON) serialization: 'advanced' lost replies inside Electron's main process.
  });

  child.on('message', (msg) => {
    if (msg.type === 'status') {
      _workerReady = msg.status === 'ready';
      _broadcastProgress({ status: msg.status });
    } else if (msg.type === 'progress') {
      _broadcastProgress({ status: msg.status, file: msg.file, progress: msg.progress });
    } else if (msg.type === 'load-result' || msg.type === 'transcribe-result') {
      const p = _pending.get(msg.id);
      if (p) {
        _pending.delete(msg.id);
        if (msg.ok) p.resolve(msg);
        else        p.reject(new Error(msg.error));
      }
    }
  });

  child.on('error', (err) => {
    if (_worker !== child) return; // stale child that was already replaced
    log.error('whisper worker error', { error: err.message });
    for (const [, p] of _pending) p.reject(err);
    _pending.clear();
    _worker = null;
    _workerReady = false;
    _loadPromise = null;
    _loadedProfile = null;
  });

  child.on('exit', (code) => {
    if (_worker !== child) return; // stale child that was already replaced
    if (code !== 0) log.warn('whisper worker exited with code', { code });
    for (const [, p] of _pending) p.reject(new Error(`whisper process exited (code ${code})`));
    _pending.clear();
    _worker = null;
    _workerReady = false;
    _loadPromise = null;
    _loadedProfile = null;
  });

  return _worker;
}

function _broadcastProgress(data) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('whisper-progress', data);
  }
}

function _send(type, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = ++_msgCounter;
    _pending.set(id, { resolve, reject });
    _getWorker().send({ type, id, ...payload });
  });
}

/** Profile chosen in Settings (config.json `whisperModel`), falling back to the default. */
function _wantedProfile() {
  const cfg = readJsonSafe(userDataPath(FILES.CONFIG), {});
  return Object.prototype.hasOwnProperty.call(WHISPER_MODELS, cfg.whisperModel) ? cfg.whisperModel : WHISPER_DEFAULT_PROFILE;
}

function _ensureLoaded() {
  if (_workerReady) return Promise.resolve();
  if (!_loadPromise) {
    const profile = _loadedProfile || _wantedProfile();
    _loadPromise = _send('load', { modelId: WHISPER_MODELS[profile] }).then((res) => {
      _loadedProfile = profile;
      _workerReady = true;
      return res;
    }).catch((err) => {
      _loadPromise = null; // permite nova tentativa em chamada subsequente
      throw err;
    });
  }
  return _loadPromise;
}

function registerWhisperHandlers() {
  ipcMain.handle('whisper-load', async () => {
    try {
      // Called when a session starts: apply a model change made in Settings (never mid-session).
      if (_loadedProfile && _loadedProfile !== _wantedProfile()) {
        log.info('whisper model changed, reloading', { from: _loadedProfile, to: _wantedProfile() });
        killWhisperProcess();
      }
      await _ensureLoaded();
      return ok({ status: 'ready' });
    } catch (err) {
      log.error('whisper-load failed', { error: err.message });
      return fail(err);
    }
  });

  ipcMain.handle('whisper-transcribe', async (_event, { audioData, language }) => {
    try {
      // ── Processamento normal — transcrição local via worker_threads ──
      await _ensureLoaded();
      // Audio goes over the JSON channel as base64 of the raw float32 bytes (never an array of numbers).
      const f32 = audioData instanceof Float32Array ? audioData : new Float32Array(audioData);
      const audioB64 = Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength).toString('base64');
      const result = await _send('transcribe', { audioB64, language });
      const text = result.text;

      return ok({ text });
    } catch (err) {
      log.error('whisper-transcribe failed', { error: err.message });
      return fail(err);
    }
  });
}

function killWhisperProcess() {
  if (_worker) {
    _worker.kill();
    _worker = null;
    _workerReady = false;
    _loadPromise = null;
    _loadedProfile = null;
  }
}

module.exports = { registerWhisperHandlers, killWhisperProcess };
