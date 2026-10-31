'use strict';

// Whisper transcription — local inference via @xenova/transformers (Xenova/whisper-base),
// running inside a worker_thread (Node), not a Web Worker.
//
// External IPC contract is preserved: { audioData: Float32Array, language } -> ok({ text }) / fail(err).

const { ipcMain, BrowserWindow } = require('electron');
const { Worker }        = require('worker_threads');
const path               = require('path');
const { createLogger }  = require('../../services/logger');
const { ok, fail }       = require('../../shared/utils');

const log = createLogger('whisper');

let _worker = null;
let _workerReady = false;
let _loadPromise = null;
let _msgCounter = 0;
const _pending = new Map(); // id -> { resolve, reject }

function _getWorker() {
  if (_worker) return _worker;

  _worker = new Worker(path.join(__dirname, '..', 'whisper-local-worker.js'));

  _worker.on('message', (msg) => {
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

  _worker.on('error', (err) => {
    log.error('whisper worker error', { error: err.message });
    for (const [, p] of _pending) p.reject(err);
    _pending.clear();
    _worker = null;
    _workerReady = false;
    _loadPromise = null;
  });

  _worker.on('exit', (code) => {
    if (code !== 0) log.warn('whisper worker exited with code', { code });
    _worker = null;
    _workerReady = false;
    _loadPromise = null;
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
    _getWorker().postMessage({ type, id, ...payload });
  });
}

function _ensureLoaded() {
  if (_workerReady) return Promise.resolve();
  if (!_loadPromise) {
    _loadPromise = _send('load').then((res) => {
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
      const result = await _send('transcribe', { audioData, language });
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
    _worker.terminate();
    _worker = null;
    _workerReady = false;
    _loadPromise = null;
  }
}

module.exports = { registerWhisperHandlers, killWhisperProcess };
