'use strict';

// ── Optional meeting sync ───────────────────────────────────────
// Local-first: meetings always live in the local SQLite database. When a server URL is
// configured (Settings → Sync), saves/edits/deletes are mirrored to the OpenFatoAI backend
// in the background. There are no accounts — each install has an anonymous UUID
// (`installationId` in config.json) sent in the X-Installation-Id header.

const crypto = require('crypto');
const { userDataPath, readJsonSafe, writeJsonSafe } = require('../shared/utils');
const { FILES } = require('../shared/constants');
const db = require('./database');
const { createLogger } = require('./logger');

const log = createLogger('services:sync');

const REQUEST_TIMEOUT_MS = 8000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function _readConfig() {
  return readJsonSafe(userDataPath(FILES.CONFIG), {});
}

/** Returns this install's anonymous id, creating and persisting it on first use. */
function getInstallationId() {
  const config = _readConfig();
  if (typeof config.installationId === 'string' && UUID_PATTERN.test(config.installationId)) {
    return config.installationId;
  }
  const installationId = crypto.randomUUID();
  writeJsonSafe(userDataPath(FILES.CONFIG), { ...config, installationId });
  return installationId;
}

function _isPrivateHost(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]' || hostname.endsWith('.local')) return true;
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/**
 * Validates and normalizes a server URL.
 * https is required, except for localhost / private-network addresses.
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
function normalizeServerUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: true, url: '' };
  let u;
  try { u = new URL(raw); } catch { return { ok: false, error: 'invalid_url' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'invalid_url' };
  if (u.protocol === 'http:' && !_isPrivateHost(u.hostname)) return { ok: false, error: 'insecure_url' };
  return { ok: true, url: raw.replace(/\/+$/, '') };
}

function getSyncConfig() {
  const config = _readConfig();
  const parsed = normalizeServerUrl(config.syncServerUrl);
  const serverUrl = parsed.ok ? parsed.url : '';
  return { serverUrl, enabled: serverUrl !== '', installationId: getInstallationId() };
}

function setServerUrl(input) {
  const parsed = normalizeServerUrl(input);
  if (!parsed.ok) return parsed;
  writeJsonSafe(userDataPath(FILES.CONFIG), { ..._readConfig(), syncServerUrl: parsed.url });
  return { ok: true, url: parsed.url };
}

async function _request(serverUrl, method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${serverUrl}${path}`, {
      method,
      headers: {
        'X-Installation-Id': getInstallationId(),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function _toApiBody(row) {
  return {
    meetingType:     row.meeting_type === 1 ? 1 : 2,
    summaryType:     row.summary_type    ?? null,
    transcriptText:  row.transcript_text ?? null,
    aiSummary:       row.ai_summary      ?? null,
    promptUsed:      row.prompt_used     ?? null,
    recordedSeconds: Math.min(Math.max(Number(row.recorded_seconds) || 0, 0), 86400),
    aiProvider:      row.ai_provider     ?? null,
    aiModel:         row.ai_model        ?? null,
    language:        row.language        ?? null,
  };
}

/** Checks that the URL points to a reachable OpenFatoAI backend. */
async function testConnection(input) {
  const parsed = normalizeServerUrl(input);
  if (!parsed.ok) return parsed;
  if (!parsed.url) return { ok: false, error: 'invalid_url' };
  try {
    const res = await _request(parsed.url, 'GET', '/health');
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    const json = await res.json().catch(() => null);
    return json?.status === 'healthy' ? { ok: true } : { ok: false, error: 'not_openfatoai' };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : 'unreachable' };
  }
}

/** Mirrors one local meeting to the server. No-op when sync is off. Never throws. */
async function pushMeeting(row) {
  const { serverUrl, enabled } = getSyncConfig();
  if (!enabled || !row?.session_hash) return { ok: true, skipped: true };
  try {
    const res = await _request(serverUrl, 'PUT', `/api/meetings/${encodeURIComponent(row.session_hash)}`, _toApiBody(row));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (err) {
    log.warn('sync push failed', { session: row.session_hash, error: err.message });
    return { ok: false, error: err.message };
  }
}

/** Removes a meeting from the server by its session hash. No-op when sync is off. Never throws. */
async function deleteMeeting(sessionHash) {
  const { serverUrl, enabled } = getSyncConfig();
  if (!enabled || !sessionHash) return { ok: true, skipped: true };
  try {
    const res = await _request(serverUrl, 'DELETE', `/api/meetings/by-session/${encodeURIComponent(sessionHash)}`);
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (err) {
    log.warn('sync delete failed', { session: sessionHash, error: err.message });
    return { ok: false, error: err.message };
  }
}

/** Pushes every local meeting (idempotent upserts). Used for the first sync and to retry failures. */
async function pushAll() {
  const { enabled } = getSyncConfig();
  if (!enabled) return { ok: false, error: 'sync_disabled' };
  const rows = db.listAllMeetings();
  let pushed = 0;
  let failed = 0;
  for (const row of rows) {
    const res = await pushMeeting(row);
    if (res.ok) pushed++; else failed++;
  }
  return { ok: true, total: rows.length, pushed, failed };
}

module.exports = { getInstallationId, getSyncConfig, setServerUrl, testConnection, pushMeeting, deleteMeeting, pushAll, normalizeServerUrl };
