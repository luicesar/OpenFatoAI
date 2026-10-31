'use strict';

// ── IPC: optional meeting sync (Settings → Sync) ─────────────────

const { ipcMain } = require('electron');
const { IPC } = require('../../shared/constants');
const { ok, fail } = require('../../shared/utils');
const { createLogger } = require('../../services/logger');
const sync = require('../../services/sync');

const log = createLogger('ipc:sync');

function registerSyncHandlers() {
  ipcMain.handle(IPC.SYNC_GET_CONFIG, async () => {
    try {
      return ok({ data: sync.getSyncConfig() });
    } catch (err) {
      log.error('sync:get-config failed', { error: err.message });
      return fail(err);
    }
  });

  ipcMain.handle(IPC.SYNC_SET_CONFIG, async (_event, { serverUrl } = {}) => {
    const res = sync.setServerUrl(serverUrl);
    if (!res.ok) return fail(res.error);
    return ok({ data: sync.getSyncConfig() });
  });

  ipcMain.handle(IPC.SYNC_TEST, async (_event, { serverUrl } = {}) => {
    const res = await sync.testConnection(serverUrl);
    return res.ok ? ok() : fail(res.error);
  });

  ipcMain.handle(IPC.SYNC_PUSH_ALL, async () => {
    try {
      const res = await sync.pushAll();
      return res.ok ? ok({ data: { total: res.total, pushed: res.pushed, failed: res.failed } }) : fail(res.error);
    } catch (err) {
      log.error('sync:push-all failed', { error: err.message });
      return fail(err);
    }
  });
}

module.exports = { registerSyncHandlers };
