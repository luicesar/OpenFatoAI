'use strict';

const fs = require('fs');
const { userDataPath } = require('../shared/utils');
const { FILES } = require('../shared/constants');

// ── Log levels ──────────────────────────────────────────────────
const LEVEL = Object.freeze({ DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 });

let _minLevel = process.env.NODE_ENV === 'development' ? LEVEL.DEBUG : LEVEL.INFO;

/**
 * Sets the minimum log level to display / persist.
 * @param {'debug'|'info'|'warn'|'error'} level
 */
function setLevel(level) {
  const map = { debug: LEVEL.DEBUG, info: LEVEL.INFO, warn: LEVEL.WARN, error: LEVEL.ERROR };
  if (map[level] !== undefined) _minLevel = map[level];
}

// ── Core emit ────────────────────────────────────────────────────

function _emit(level, label, msg, meta) {
  if (level < _minLevel) return;

  const timestamp  = new Date().toISOString();
  const levelNames = ['DEBUG', 'INFO ', 'WARN ', 'ERROR'];
  const line = `[${timestamp}] ${levelNames[level]} [${label}] ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`;

  if (level >= LEVEL.ERROR) {
    console.error(line);
  } else if (level === LEVEL.WARN) {
    console.warn(line);
  } else {
    console.log(line);
  }
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Creates a namespaced logger.
 * @param {string} namespace - e.g. 'ipc:ocr', 'main:window'
 */
function createLogger(namespace) {
  return {
    debug : (msg, meta) => _emit(LEVEL.DEBUG, namespace, msg, meta),
    info  : (msg, meta) => _emit(LEVEL.INFO,  namespace, msg, meta),
    warn  : (msg, meta) => _emit(LEVEL.WARN,  namespace, msg, meta),
    error : (msg, meta) => _emit(LEVEL.ERROR, namespace, msg, meta),
  };
}

/** Default app-wide logger. */
const logger = createLogger('app');

module.exports = { createLogger, logger, setLevel };
