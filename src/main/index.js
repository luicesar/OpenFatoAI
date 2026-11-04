'use strict';

// ── Main process entry point ─────────────────────────────────────
// Responsibilities: boot app, register IPC handlers, manage lifecycle.
// All feature logic lives in ipc/, services/, and shared/.

// Optional dotenv: allows local .env overrides (e.g. GEMINI_API_URL)
try { require('dotenv').config(); } catch (_) {}

const path = require('path');
const { app, globalShortcut, protocol, session, Menu, desktopCapturer } = require('electron');

// Disable GPU hardware acceleration before anything else — Linux only.
// Intel i915 VA-API fails to initialize on this hardware with Electron 42+,
// crashing the GPU process and destroying the window before ready-to-show fires.
// On Windows, disabling hardware acceleration breaks Chromium's audio service
// (WASAPI), causing getUserMedia to throw NotReadableError for every microphone.
if (process.platform === 'linux') {
  app.disableHardwareAcceleration();
}

// Register custom scheme BEFORE app is ready (required by Electron)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vosk-model',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true, stream: true }
  }
]);

// Enable Chromium flags for screen capture APIs before app is ready
try {
  app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
  app.commandLine.appendSwitch('enable-experimental-web-platform-features');
  app.commandLine.appendSwitch('enable-speech-dispatcher');          // TTS/STT on Linux
  app.commandLine.appendSwitch('enable-features', 'WebSpeechAPI');  // Web Speech API
  app.commandLine.appendSwitch('ozone-platform', 'x11');            // force X11 for global shortcuts (Wayland blocks them)
  // Workaround: on some Windows machines (Intel Smart Sound Technology mic arrays),
  // the out-of-process audio service fails to open WASAPI input streams and
  // getUserMedia throws NotReadableError "Could not start audio source" even
  // with simple constraints. Running audio capture in-process avoids this.
  app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess');
} catch (e) {
  // Non-fatal — some Electron builds may not support these switches
}

// Must run before the logger (or anything else) creates the new userData folder
require('./migrate-userdata').migrateLegacyUserData();

const { createLogger }          = require('../services/logger');
const { createWindow, getWin }  = require('./window');
const { createTray }            = require('./menu');
const { GLOBAL_SHORTCUT }       = require('../shared/constants');

// ── IPC handler registrations ────────────────────────────────────
const { registerConfigHandlers }        = require('./ipc/config');
const { registerAiHandlers }             = require('./ipc/ai');
const { registerScreenHandlers, init: initScreenHandlers } = require('./ipc/screen');
const { registerWhisperHandlers, killWhisperProcess } = require('./ipc/whisper');
const { registerTranscriptionHandlers }  = require('./ipc/transcriptions');
const { registerDiarizationHandlers, killDiarizationProcess } = require('./ipc/diarization');
const { registerWindowHandlers }        = require('./ipc/window');
const { registerUpdateHandlers, checkAndNotifyUpdate } = require('./ipc/update');
const db                                 = require('../services/database');

const log = createLogger('main');

// ── Single instance lock ─────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = getWin();
    if (win) { win.show(); win.focus(); }
  });
}

// ── Global error boundary ────────────────────────────────────────
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception in main process', { stack: err?.stack ?? String(err) });
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled promise rejection in main process', { reason: String(reason) });
});

// ── App lifecycle ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  log.info('App ready — booting');

  // Enable SharedArrayBuffer for vosk-browser WASM (requires COOP + COEP)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['credentialless'],
      }
    });
  });

  // Fallback de áudio do sistema (Windows/macOS) via loopback nativo do Electron.
  // Acionado apenas quando o renderer chama navigator.mediaDevices.getDisplayMedia()
  // (em tryStartSystemAudio(), quando nenhum dispositivo "monitor" PulseAudio é encontrado
  // e a plataforma não é Linux). Não afeta nenhum fluxo existente.
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (sources && sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' });
      } else {
        callback({});
      }
    }).catch((err) => {
      log.error('setDisplayMediaRequestHandler: falha ao obter desktop sources', { error: String(err) });
      callback({});
    });
  }, { useSystemPicker: false });

  // IPC: read vosk model file and return its raw bytes to the renderer.
  // The renderer creates a Blob URL from the buffer — avoids custom protocol
  // issues with Workers spawned internally by vosk-browser.
  const { ipcMain } = require('electron');
  const fs = require('fs');
  ipcMain.handle('read-model-file', (_, filename) => {
    const filePath = path.join(__dirname, '..', 'models', filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Model file not found: ${filePath}`);
    }
    return fs.readFileSync(filePath); // Buffer → auto-serialised as ArrayBuffer over IPC
  });

  // 1. Create UI
  Menu.setApplicationMenu(null);
  const win = createWindow();
  createTray();

  // 2. Open database (async WASM init). Wrapped in try/catch so a DB failure
  //    never prevents the remaining IPC handlers from being registered.
  try {
    await db.open(app.getPath('userData'));
  } catch (dbErr) {
    log.error('[db] Failed to open database — transcription save/list will be unavailable', { error: dbErr.message });
  }

  // 3. Register all IPC handlers
  registerConfigHandlers();
  registerAiHandlers();
  initScreenHandlers(win);   // inject win reference
  registerScreenHandlers();
  registerWhisperHandlers();
  registerTranscriptionHandlers();
  registerDiarizationHandlers();
  registerWindowHandlers();
  registerUpdateHandlers();
  ipcMain.handle('get-app-version', () => app.getVersion());

  // Verificacao de atualizacao: disparar uma unica vez apos o renderer estar pronto
  win.webContents.once('did-finish-load', () => {
    checkAndNotifyUpdate(win);
  });

  // 3. Global shortcut: toggle window visibility
  try {
    const ok = globalShortcut.register(GLOBAL_SHORTCUT, () => {
      const w = getWin();
      if (!w) return;
      if (w.isVisible()) {
        console.log('[shortcut] hiding window');
        if (w.webContents.isDevToolsOpened()) w.webContents.closeDevTools();
        w.hide();
      } else {
        console.log('[shortcut] showing window');
        w.show();
        w.focus();
      }
    });
    console.log(`[shortcut] register result: ${ok} (${GLOBAL_SHORTCUT})`);
    if (ok) {
      log.info(`Global shortcut registered: ${GLOBAL_SHORTCUT}`);
    } else {
      log.warn(`Global shortcut FAILED to register (already taken by OS): ${GLOBAL_SHORTCUT}`);
      console.warn(`[shortcut] FAILED — ${GLOBAL_SHORTCUT} already taken by OS (IBus/GNOME?)`);
    }
  } catch (e) {
    log.warn('Could not register global shortcut', { error: e.message });
  }

  // macOS: re-create window if dock icon is clicked and no windows are open
  app.on('activate', () => {
    const { BrowserWindow } = require('electron');
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  killWhisperProcess();
  killDiarizationProcess();
  db.close();
  log.info('App quitting — shortcuts unregistered');
});

app.on('window-all-closed', () => {
  // Keep running in the background (stealth / always-on mode).
  // On macOS this is the default; on Linux/Windows we intentionally do NOT quit.
});
