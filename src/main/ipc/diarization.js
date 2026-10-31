'use strict';

const { ipcMain }      = require('electron');
const { spawn }        = require('child_process');
const path             = require('path');
const fs               = require('fs');
const { createLogger } = require('../../services/logger');

const log = createLogger('diarization');

const PYTHON_SCRIPT = path.join(__dirname, '../../python/diarization_service.py');
const PYTHON_BIN    = path.join(__dirname, '../../python/venv/bin/python3');

let _proc          = null;   // child process
let _ready         = false;  // became ready after "status: ready" line
let _pending       = new Map(); // chunk_id → { resolve, reject, timer }
let _lineBuffer    = '';

function getProcess() {
  if (_proc) return _proc;

  if (!fs.existsSync(PYTHON_BIN)) {
    throw new Error('Serviço de diarização Python não disponível nesta instalação. Configure o ambiente Python local para usar esta função.');
  }

  log.info('Spawning diarization service');
  _proc = spawn(PYTHON_BIN, [PYTHON_SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] });
  _ready = false;

  _proc.stdout.on('data', (data) => {
    _lineBuffer += data.toString();
    const lines = _lineBuffer.split('\n');
    _lineBuffer  = lines.pop(); // keep incomplete last line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);

        if (msg.status === 'ready') {
          _ready = true;
          log.info('Diarization service ready');
          continue;
        }

        const handler = _pending.get(msg.chunk_id);
        if (handler) {
          clearTimeout(handler.timer);
          _pending.delete(msg.chunk_id);
          if (msg.error) handler.reject(new Error(msg.error));
          else           handler.resolve(msg.speakers || []);
        }
      } catch (_) { /* malformed line — ignore */ }
    }
  });

  _proc.stderr.on('data', (d) => log.warn('diarization stderr', { msg: d.toString().trim() }));

  _proc.on('exit', (code) => {
    log.warn('Diarization service exited', { code });
    _proc   = null;
    _ready  = false;
    // Reject all pending requests
    for (const [, handler] of _pending) {
      clearTimeout(handler.timer);
      handler.reject(new Error('diarization process exited'));
    }
    _pending.clear();
  });

  return _proc;
}

// Reset speaker registry — call at the start of each new transcription session
function resetRegistry() {
  if (!_proc) return;
  _proc.stdin.write(JSON.stringify({ action: 'reset' }) + '\n');
}

// Send audio chunk to Python, returns Promise<speakers[]>
// Never rejects — returns [] on any failure so transcription is not blocked.
function diarizeChunk(chunkId, float32, sampleRate = 16000) {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = getProcess();
    } catch (err) {
      log.warn('diarizeChunk: service unavailable', { error: err.message });
      resolve([]);
      return;
    }

    // Reject pending request if the process crashes
    const onProcError = (err) => {
      clearTimeout(timer);
      _pending.delete(chunkId);
      log.warn('diarizeChunk: process error', { error: err.message });
      resolve([]);
    };
    proc.once('error', onProcError);

    const timer = setTimeout(() => {
      proc.removeListener('error', onProcError);
      _pending.delete(chunkId);
      resolve([]);
    }, 30000);

    _pending.set(chunkId, {
      resolve: (speakers) => { proc.removeListener('error', onProcError); resolve(speakers); },
      reject:  (err)      => { proc.removeListener('error', onProcError); resolve([]); },
      timer,
    });

    try {
      const audioB64 = Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength).toString('base64');
      const payload  = JSON.stringify({ chunk_id: chunkId, audio: audioB64, sample_rate: sampleRate });
      proc.stdin.write(payload + '\n');
    } catch (err) {
      clearTimeout(timer);
      proc.removeListener('error', onProcError);
      _pending.delete(chunkId);
      log.warn('diarizeChunk: stdin write failed', { error: err.message });
      resolve([]);
    }
  });
}

function registerDiarizationHandlers() {
  // Warm up the Python process on app start (non-blocking)
  try { getProcess(); } catch (_) {}

  ipcMain.handle('diarization-reset', async () => {
    resetRegistry();
    return { ok: true };
  });

  ipcMain.handle('diarize-chunk', async (_, { chunkId, audioData, sampleRate }) => {
    try {
      let float32;
      if (audioData instanceof Float32Array) {
        float32 = audioData;
      } else if (audioData instanceof ArrayBuffer) {
        float32 = new Float32Array(audioData);
      } else if (ArrayBuffer.isView(audioData)) {
        float32 = new Float32Array(audioData.buffer, audioData.byteOffset, audioData.byteLength / 4);
      } else {
        float32 = new Float32Array(audioData);
      }

      const speakers = await diarizeChunk(chunkId, float32, sampleRate || 16000);
      return { ok: true, speakers };
    } catch (err) {
      log.error('diarize-chunk failed', { error: err.message });
      return { ok: false, error: err.message };
    }
  });
}

function killDiarizationProcess() {
  if (_proc) { _proc.kill(); _proc = null; }
}

module.exports = { registerDiarizationHandlers, killDiarizationProcess, resetRegistry };
