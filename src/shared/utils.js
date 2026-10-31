'use strict';

const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const { app } = require('electron');

// ── File helpers ────────────────────────────────────────────────

/**
 * Returns a path inside the Electron userData directory.
 * @param {string} filename
 * @returns {string}
 */
function userDataPath(filename) {
  return path.join(app.getPath('userData'), filename);
}

/**
 * Reads and parses a JSON file; returns fallback on any error.
 * @param {string} filePath
 * @param {*} fallback
 * @returns {*}
 */
function readJsonSafe(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) ?? fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * Writes an object as pretty JSON; returns true on success.
 * @param {string} filePath
 * @param {object} data
 * @returns {boolean}
 */
function writeJsonSafe(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

// ── Promise helpers ─────────────────────────────────────────────

/**
 * Simple async sleep.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Temp file helpers ────────────────────────────────────────────

/**
 * Returns a unique temp file path with the given extension.
 * @param {string} prefix
 * @param {string} ext - e.g. '.png'
 * @returns {string}
 */
function tempFilePath(prefix = 'openfatoai', ext = '.tmp') {
  const tmpDir = (app && app.getPath ? app.getPath('temp') : null) || os.tmpdir();
  return path.join(tmpDir, `${prefix}-${Date.now()}${ext}`);
}

/**
 * Deletes a file silently (never throws).
 * @param {string} filePath
 */
function unlinkSafe(filePath) {
  try { fs.unlinkSync(filePath); } catch (_) {}
}

// ── Standard IPC response shapes ────────────────────────────────

/** @returns {{ ok: true, [extra: string]: any }} */
function ok(extra = {}) { return { ok: true, ...extra }; }

/** @returns {{ ok: false, error: string }} */
function fail(error) {
  const msg = (error instanceof Error) ? error.message : String(error);
  return { ok: false, error: msg };
}

module.exports = {
  userDataPath,
  readJsonSafe,
  writeJsonSafe,
  sleep,
  tempFilePath,
  unlinkSafe,
  ok,
  fail,
};
