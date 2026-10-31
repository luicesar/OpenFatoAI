'use strict';

// ── Update check via GitHub Releases ─────────────────────────────
// Asks the public GitHub API for the latest published release of the project and compares
// it with the running version. No project-owned server involved. Set `"checkForUpdates": false`
// in config.json to disable the check entirely.

const { ipcMain } = require('electron');
const { createLogger } = require('../../services/logger');
const { ok, fail, userDataPath, readJsonSafe } = require('../../shared/utils');
const { APP_VERSION, GITHUB_REPO, FILES, IPC } = require('../../shared/constants');

const CHANNEL_UPDATE_CHECK        = IPC.UPDATE_CHECK;
const CHANNEL_UPDATE_AVAILABLE    = IPC.UPDATE_AVAILABLE;
const CHANNEL_SHELL_OPEN_EXTERNAL = IPC.SHELL_OPEN_EXTERNAL;

const LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const RELEASE_PAGE_PREFIX = `https://github.com/${GITHUB_REPO}/`;
const REQUEST_TIMEOUT_MS = 5_000;

const log = createLogger('ipc:update');

// ── Semver comparison (manual — no semver dep) ───────────────────
/** "v1.2.3", "1.2.3-beta.1" → [1, 2, 3]; null when not a valid version. */
function _parseVersion(v) {
  const m = String(v ?? '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function _isNewer(latestVersion, currentVersion) {
  const l = _parseVersion(latestVersion);
  const c = _parseVersion(currentVersion);
  if (!l || !c) return false;
  for (let i = 0; i < 3; i++) {
    if (l[i] !== c[i]) return l[i] > c[i];
  }
  return false;
}

function _updatesDisabled() {
  return readJsonSafe(userDataPath(FILES.CONFIG), {}).checkForUpdates === false;
}

/**
 * Fetches the latest GitHub release.
 * @returns {Promise<{ version: string, downloadUrl: string } | null>}  null when there is no release yet
 * @throws on network errors or unexpected HTTP statuses
 */
async function _fetchLatestRelease() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(LATEST_RELEASE_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': `OpenFatoAI/${APP_VERSION}`,
      },
    });
    // 404 = no published release yet (or repository not public): nothing to update to
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data.draft || data.prerelease || !_parseVersion(data.tag_name)) return null;

    // Only ever hand the renderer a link to this project's own release pages
    const downloadUrl = typeof data.html_url === 'string' && data.html_url.startsWith(RELEASE_PAGE_PREFIX)
      ? data.html_url
      : `${RELEASE_PAGE_PREFIX}releases/latest`;

    return { version: String(data.tag_name).replace(/^v/, ''), downloadUrl };
  } finally {
    clearTimeout(timeout);
  }
}

// ── IPC handler: update:check (invoke) ──────────────────────────
function registerUpdateHandlers() {
  ipcMain.handle(CHANNEL_UPDATE_CHECK, async () => {
    if (_updatesDisabled()) return ok({ hasUpdate: false, latestVersion: null, downloadUrl: null });
    try {
      const latest = await _fetchLatestRelease();
      if (!latest) return ok({ hasUpdate: false, latestVersion: null, downloadUrl: null });

      return ok({
        hasUpdate:     _isNewer(latest.version, APP_VERSION),
        latestVersion: latest.version,
        downloadUrl:   latest.downloadUrl,
      });
    } catch (e) {
      if (e.name === 'AbortError') return fail('network_error');
      log.warn('update:check failed', { error: e.message });
      return fail('network_error');
    }
  });

  // ── shell:open-external ───────────────────────────────────────
  ipcMain.handle(CHANNEL_SHELL_OPEN_EXTERNAL, async (_, url) => {
    if (typeof url !== 'string' || !url.startsWith('https://')) return fail('invalid_url');
    const { shell } = require('electron');
    await shell.openExternal(url);
    return ok();
  });

  log.info('Update IPC handlers registered');
}

// ── Push: checkAndNotifyUpdate (called from index.js) ────────────
async function checkAndNotifyUpdate(win) {
  if (_updatesDisabled()) return;
  try {
    const latest = await _fetchLatestRelease();
    if (latest && _isNewer(latest.version, APP_VERSION)) {
      win.webContents.send(CHANNEL_UPDATE_AVAILABLE, {
        latestVersion: latest.version,
        downloadUrl:   latest.downloadUrl,
      });
    }
  } catch (_) {
    // Fail-open: a network error at startup must not degrade the app
  }
}

module.exports = { registerUpdateHandlers, checkAndNotifyUpdate, _isNewer, _parseVersion };
