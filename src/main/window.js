'use strict';

// ── Window management ────────────────────────────────────────────

const { BrowserWindow, ipcMain, nativeImage, app } = require('electron');
const path            = require('path');
const { createLogger} = require('../services/logger');
const { GLOBAL_SHORTCUT } = require('../shared/constants');

const log = createLogger('main:window');

/** @type {BrowserWindow | null} */
let win = null;

/** Set to true before calling app.quit() so the close handler allows the window to close. */
let isQuitting = false;

/**
 * Returns the current main BrowserWindow (or null if not created yet).
 * @returns {BrowserWindow | null}
 */
function getWin() { return win; }

/**
 * Creates (or re-creates) the main application window.
 * @returns {BrowserWindow}
 */
function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../resources/icon.png');

  win = new BrowserWindow({
    width       : 1100,
    height      : 700,
    show        : false,
    frame       : false,
    transparent : true,
    skipTaskbar : true,
    alwaysOnTop : true,
    icon        : iconPath,
    webPreferences: {
      preload          : path.join(__dirname, 'preload.js'),
      contextIsolation : true,
      nodeIntegration  : false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Prevent the window from showing in screen shares/recordings
  try {
    win.setContentProtection(true);
  } catch (e) {
    log.warn('setContentProtection not supported', { error: e.message });
  }

  win.once('ready-to-show', () => {
    try { win.show(); } catch (e) { log.warn('win.show() failed', { error: e.message }); }
    log.info('Window ready and shown');
  });

  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        if (win.webContents.isDevToolsOpened()) {
          win.webContents.closeDevTools();
        } else {
          win.webContents.openDevTools();
        }
      }
    });
  }

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    win = null;
    log.info('BrowserWindow closed');
  });

  // Register IPC handler to hide window from renderer ("panic button")
  ipcMain.handle('hide-window', async () => {
    try {
      if (win) {
        if (win.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
        win.hide();
      }
    } catch (_) {}
    return { ok: true };
  });

  log.info('Main window created');
  return win;
}

module.exports = { createWindow, getWin, setQuitting: (v) => { isQuitting = v; } };
