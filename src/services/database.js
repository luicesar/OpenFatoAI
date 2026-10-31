'use strict';

// ── Database service (sql.js / WebAssembly SQLite) ──────────────
// Pure JS/WASM — no native addon, no GLIBC compatibility issues.
// Must run in the main process only — never in the renderer.

const path = require('path');
const fs   = require('fs');
const log  = require('electron-log');

/** @type {import('sql.js').Database | null} */
let _db     = null;
let _dbPath = null;

// ── Schema ───────────────────────────────────────────────────────
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS meetings (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_hash     TEXT    NOT NULL UNIQUE,
    meeting_type     INTEGER NOT NULL DEFAULT 1,
    summary_type     TEXT,
    transcript_text  TEXT,
    ai_summary       TEXT,
    prompt_used      TEXT,
    recorded_seconds INTEGER NOT NULL DEFAULT 0,
    ai_provider      TEXT,
    ai_model         TEXT,
    language         TEXT,
    email            TEXT    NOT NULL DEFAULT 'fatosystem@gmail.com',
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

/** Persists the in-memory database to disk. Throws on failure so callers can propagate. */
function _save() {
  if (!_db || !_dbPath) return;
  const data = _db.export();
  fs.writeFileSync(_dbPath, Buffer.from(data));
}

/**
 * Opens (or creates) the SQLite database via sql.js (WASM).
 * @param {string} userDataPath  Electron app.getPath('userData')
 */
async function open(userDataPath) {
  if (_db) return;
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  _dbPath = path.join(userDataPath, 'fato-ai.db');
  const fileExists = fs.existsSync(_dbPath);
  log.info('[db] opening', _dbPath, '| exists:', fileExists,
    fileExists ? '| size: ' + fs.statSync(_dbPath).size + 'B' : '');

  if (fileExists) {
    const filebuffer = fs.readFileSync(_dbPath);
    try {
      _db = new SQL.Database(filebuffer);
    } catch (e) {
      const backup = _dbPath + '.corrupted-' + Date.now();
      log.error('[db] file corrupted — backing up to', backup, '|', e.message);
      fs.renameSync(_dbPath, backup);
      _db = new SQL.Database();
    }
  } else {
    _db = new SQL.Database();
  }

  _db.run('PRAGMA foreign_keys = ON');
  _db.run(CREATE_TABLE);
  _save();
  log.info('[db] ready');
}

/** Saves to disk and closes the database. */
function close() {
  if (_db) { _save(); _db.close(); _db = null; }
}

/** Returns true if the DB connection is open. */
function isOpen() {
  return _db !== null;
}

// ── CRUD ─────────────────────────────────────────────────────────

/**
 * INSERT OR UPDATE a meeting (idempotent via session_hash).
 * @returns {{ id: number | null }}
 */
function saveTranscription(data) {
  if (!_db) throw new Error('Database not open');
  _db.run(`
    INSERT INTO meetings
      (session_hash, meeting_type, summary_type, transcript_text, ai_summary,
       prompt_used, recorded_seconds, ai_provider, ai_model, language, email,
       created_at, updated_at)
    VALUES
      (:session_hash, :meeting_type, :summary_type, :transcript_text, :ai_summary,
       :prompt_used, :recorded_seconds, :ai_provider, :ai_model, :language, :email,
       datetime('now'), datetime('now'))
    ON CONFLICT(session_hash) DO UPDATE SET
      meeting_type     = excluded.meeting_type,
      summary_type     = excluded.summary_type,
      transcript_text  = excluded.transcript_text,
      ai_summary       = excluded.ai_summary,
      prompt_used      = excluded.prompt_used,
      recorded_seconds = excluded.recorded_seconds,
      ai_provider      = excluded.ai_provider,
      ai_model         = excluded.ai_model,
      language         = excluded.language,
      email            = excluded.email,
      updated_at       = datetime('now')
  `, {
    ':session_hash':     data.session_hash,
    ':meeting_type':     data.meeting_type     ?? 2,
    ':summary_type':     data.summary_type     ?? null,
    ':transcript_text':  data.transcript_text  ?? null,
    ':ai_summary':       data.ai_summary       ?? null,
    ':prompt_used':      data.prompt_used      ?? null,
    ':recorded_seconds': data.recorded_seconds ?? 0,
    ':ai_provider':      data.ai_provider      ?? null,
    ':ai_model':         data.ai_model         ?? null,
    ':language':         data.language         ?? null,
    ':email':            data.email            ?? 'fatosystem@gmail.com',
  });
  // Retrieve actual row id (works for both INSERT and UPDATE paths)
  const idStmt = _db.prepare('SELECT id FROM meetings WHERE session_hash = :s');
  idStmt.bind({ ':s': data.session_hash });
  const id = idStmt.step() ? (idStmt.getAsObject().id ?? null) : null;
  idStmt.free();
  try {
    _save();
  } catch (e) {
    log.error('[db] persist failed after save', e.message);
    throw e;
  }
  return { id };
}

/**
 * Paginated list with optional full-text search.
 * @returns {{ rows: object[], total: number, page: number, totalPages: number }}
 */
function listTranscriptions({ page = 1, limit = 15, search = '' } = {}) {
  if (!_db) throw new Error('Database not open');
  const offset = (page - 1) * limit;

  const hasSearch = Boolean(search);
  const where     = hasSearch
    ? 'WHERE ai_summary LIKE :like OR transcript_text LIKE :like OR ai_provider LIKE :like'
    : '';
  const params    = hasSearch
    ? { ':like': `%${search}%`, ':limit': limit, ':offset': offset }
    : { ':limit': limit, ':offset': offset };
  // The count query only binds :like (when searching); rows also bind :limit/:offset.
  const countParams = hasSearch ? { ':like': params[':like'] } : {};

  const countSQL = `SELECT COUNT(*) as cnt FROM meetings ${where}`;
  const rowsSQL  = `
    SELECT id, session_hash, meeting_type, summary_type, recorded_seconds,
           ai_provider, ai_model, language, created_at, updated_at,
           substr(ai_summary, 1, 120) as ai_summary_preview
    FROM meetings ${where}
    ORDER BY created_at DESC LIMIT :limit OFFSET :offset`;

  const cStmt = _db.prepare(countSQL);
  cStmt.bind(countParams);
  const total = cStmt.step() ? Number(cStmt.getAsObject().cnt ?? 0) : 0;
  cStmt.free();

  const rStmt = _db.prepare(rowsSQL);
  rStmt.bind(params);
  const rows = [];
  while (rStmt.step()) rows.push(rStmt.getAsObject());
  rStmt.free();

  return { rows, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/**
 * Get a single meeting by id.
 * @returns {object | undefined}
 */
function getTranscription(id) {
  if (!_db) throw new Error('Database not open');
  const stmt = _db.prepare('SELECT * FROM meetings WHERE id = :id');
  stmt.bind({ ':id': id });
  const row = stmt.step() ? stmt.getAsObject() : undefined;
  stmt.free();
  return row;
}

/**
 * Update editable fields of a meeting.
 */
function updateTranscription(id, data) {
  if (!_db) throw new Error('Database not open');
  _db.run(`
    UPDATE meetings
    SET ai_summary      = COALESCE(:ai_summary, ai_summary),
        transcript_text = COALESCE(:transcript_text, transcript_text),
        updated_at      = datetime('now')
    WHERE id = :id
  `, { ':id': id, ':ai_summary': data.ai_summary ?? null, ':transcript_text': data.transcript_text ?? null });
  try {
    _save();
  } catch (e) {
    log.error('[db] persist failed after update', e.message);
    throw e;
  }
}

/** All meetings with full content, oldest first (used by the optional sync). */
function listAllMeetings() {
  if (!_db) throw new Error('Database not open');
  const stmt = _db.prepare('SELECT * FROM meetings ORDER BY id');
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

/** Delete a meeting by id. */
function deleteTranscription(id) {
  if (!_db) throw new Error('Database not open');
  _db.run('DELETE FROM meetings WHERE id = :id', { ':id': id });
  try {
    _save();
  } catch (e) {
    log.error('[db] persist failed after delete', e.message);
    throw e;
  }
}

module.exports = { open, close, isOpen, saveTranscription, listTranscriptions, getTranscription, listAllMeetings, updateTranscription, deleteTranscription };
