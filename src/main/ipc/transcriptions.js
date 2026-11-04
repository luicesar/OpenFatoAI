'use strict';

// ── IPC handlers: Transcriptions CRUD ───────────────────────────
// All calls are synchronous (better-sqlite3) — wrapped in try/catch
// so the renderer always receives { ok, ... } shaped responses.

const { ipcMain } = require('electron');
const db = require('../../services/database');
const log = require('electron-log');

function registerTranscriptionHandlers() {
  // ── Save (INSERT OR REPLACE) ──────────────────────────────────
  ipcMain.handle('save-transcription', (_event, data) => {
    if (!db.isOpen()) return { ok: false, error: 'Database not available' };
    try {
      const result = db.saveTranscription(data);
      log.info('[transcriptions] saved', result);
      return { ok: true, id: result.id };
    } catch (err) {
      log.error('[transcriptions] save error', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── List (paginated + search) ─────────────────────────────────
  ipcMain.handle('list-transcriptions', (_event, opts) => {
    if (!db.isOpen()) {
      // DB not available — return empty result so the page renders cleanly
      return { ok: true, rows: [], total: 0, page: 1, totalPages: 1 };
    }
    try {
      return { ok: true, ...db.listTranscriptions(opts) };
    } catch (err) {
      log.error('[transcriptions] list error', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Get single ────────────────────────────────────────────────
  ipcMain.handle('get-transcription', (_event, id) => {
    try {
      const row = db.getTranscription(id);
      return { ok: true, row };
    } catch (err) {
      log.error('[transcriptions] get error', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Update ────────────────────────────────────────────────────
  ipcMain.handle('update-transcription', (_event, id, data) => {
    try {
      db.updateTranscription(id, data);
      log.info('[transcriptions] updated', id);
      return { ok: true };
    } catch (err) {
      log.error('[transcriptions] update error', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Delete ────────────────────────────────────────────────────
  ipcMain.handle('delete-transcription', (_event, id) => {
    try {
      db.deleteTranscription(id);
      log.info('[transcriptions] deleted', id);
      return { ok: true };
    } catch (err) {
      log.error('[transcriptions] delete error', err.message);
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { registerTranscriptionHandlers };
