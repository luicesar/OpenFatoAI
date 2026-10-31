'use strict';

// ── OCR text sanitisation ────────────────────────────────────────
// Extracted from the original monolithic main.js for reuse and testability.

const BLACKLIST = [
  'fato ia', 'openfatoai', 'prototype', 'file edit', 'file edit view', 'view window', 'help',
  'start recording', 'stop recording', 'take screenshot', 'take screenshot ocr', 'settings',
  'gemini model', 'gemini endpoint', 'gemini api', 'api key', 'prompt template',
  'save settings', 'load settings', 'log', 'favorites', 'arquivo de exemplo', 'gerado para testes',
  'gerar', 'generatecontent', 'generativelanguage', 'gemini-3', 'your-api-key',
];

const URL_REGEX        = /https?:\/\/\S+/i;
const PATH_REGEX       = /(\/|\\)\S+\/(\S+)?/;
const API_KEY_REGEX    = /[A-Za-z0-9_\-]{20,}/g;
const TEMPLATE_REGEX   = /<[^>]{1,200}>/;
const PROMPT_PATTERNS  = [
  /short answer on first line/i,
  /justification in second line/i,
  /answer\s*:/i,
  /reason\s*:/i,
  /explain briefly/i,
  /e\.g\./i,
  /example/i,
];

/**
 * Returns true for placeholder strings that carry useful human-readable content.
 * @param {string} ph
 * @returns {boolean}
 */
function isMeaningfulPlaceholder(ph) {
  if (!ph) return false;
  const s   = String(ph).trim();
  if (s.length < 4) return false;
  const low = s.toLowerCase();
  if (/https?:\/\//i.test(s))                     return false;
  if (/api[_\- ]?key/i.test(low))                 return false;
  if (/your-?api-?key/i.test(low))                return false;
  if (/^gemini(-|_)?\d|model[: ]/i.test(low))     return false;
  return s.includes(' ') || s.length > 20;
}

/**
 * Token-overlap ratio between two strings (used for fuzzy deduplication).
 * @param {string} a
 * @param {string} b
 * @returns {number} 0‒1
 */
function tokenOverlapRatio(a, b) {
  const ta = a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const tb = b.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (!ta.length || !tb.length) return 0;
  const sA  = new Set(ta);
  const sB  = new Set(tb);
  let common = 0;
  for (const t of sA) if (sB.has(t)) common++;
  const denom = Math.min(sA.size, sB.size);
  return denom === 0 ? 0 : common / denom;
}

/**
 * Cleans raw OCR output by removing noise, UI fragments, duplicates, etc.
 * @param {string} raw
 * @param {string[]} placeholders - DOM placeholder texts to exclude
 * @returns {string}
 */
function sanitizeOcrText(raw, placeholders = []) {
  if (!raw) return '';

  const meaningfulPh = placeholders
    .filter(isMeaningfulPlaceholder)
    .map((p) => String(p).replace(/\s+/g, ' ').trim().toLowerCase());

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00A9/g, '').replace(/\u00AE/g, '').trim());

  const cleaned = [];

  for (let line of lines) {
    if (!line) continue;
    line = line.replace(/\[+REDACTED\]+/gi, '').trim();
    if (!line) continue;

    const low = line.toLowerCase();

    if (TEMPLATE_REGEX.test(line))                          continue;
    if (PROMPT_PATTERNS.some((rx) => rx.test(line)))        continue;
    if (BLACKLIST.some((b) => low.includes(b)))             continue;
    if (URL_REGEX.test(line) || PATH_REGEX.test(line))      continue;
    if (meaningfulPh.some((ph) => low.includes(ph)))        continue;

    line = line.replace(API_KEY_REGEX, '');

    const letters = (line.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
    if (letters < 7) continue;

    const compact = line.replace(/\s/g, '');
    const nonAlnum = (compact.match(/[^A-Za-z0-9À-ÖØ-öø-ÿ]/g) || []).length;
    if (compact.length > 0 && nonAlnum / compact.length > 0.35) continue;

    const tokens      = line.split(/\s+/).filter(Boolean);
    const alphaTokens = tokens.filter((t) => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(t));
    if (!alphaTokens.length) continue;
    const shortTokens = tokens.filter((t) => t.length <= 2).length;
    if (tokens.length > 0 && shortTokens / tokens.length > 0.5) continue;

    const digitCount = (compact.match(/\d/g) || []).length;
    if (compact.length > 0 && digitCount / compact.length > 0.3) continue;
    if ((line.match(/@/g) || []).length > 1) continue;

    const upperCount = (line.match(/[A-ZÀ-Ö]/g) || []).length;
    if (compact.length > 0 && upperCount / compact.length > 0.7 && compact.length < 60) continue;

    line = line.replace(/\s{2,}/g, ' ').replace(/\|/g, '').trim();
    if (/^[\w\-]{1,12}$/.test(line)) continue;

    // Portuguese OCR accent corrections
    line = line
      .replace(/c6es/gi, 'ções').replace(/c6ao/gi, 'ção')
      .replace(/coes\b/gi, 'ções').replace(/cao\b/gi, 'ção')
      .replace(/(\w)cao\b/gi, (_, g) => g + 'ção');

    cleaned.push(line);
  }

  // Fuzzy deduplication
  const final = [];
  for (const l of cleaned) {
    const isDup = final.some(
      (prev) => prev.includes(l) || l.includes(prev) || tokenOverlapRatio(prev, l) >= 0.75,
    );
    if (!isDup) final.push(l);
  }

  return final.join('\n').replace(/\n{2,}/g, '\n').trim();
}

// UI button labels that documentation sites overlay on code blocks.
// A line is discarded only when its trimmed form matches one of these
// AND the trimmed length is <= 12 chars (guards against real code
// containing words like "copy" inside longer expressions).
const CODE_UI_BLACKLIST = new Set([
  'copiar', 'copy', 'copy code', 'o copiar', 'copied!', 'copiado',
  'show more', 'ver mais',
]);

/**
 * Minimal sanitisation for code-mode OCR.
 * Preserves blank lines, indentation, braces and all non-letter characters.
 * Also strips common UI button artefacts (Copy/Copiar) and fixes the
 * Tesseract misread of lone `}` as `3`.
 * @param {string} raw
 * @returns {string}
 */
function sanitizeOcrTextCode(raw) {
  if (!raw) return '';
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/©/g, '')
    .replace(/®/g, '')
    .split('\n');

  const processed = lines
    .filter((line) => {
      const t = line.trim();
      if (t.length <= 12 && CODE_UI_BLACKLIST.has(t.toLowerCase())) return false;
      return true;
    })
    .map((line) => {
      // Tesseract LSTM misreads a lone `}` as `3` in monospace fonts.
      // Only substitute when the entire trimmed line is the digit 3,
      // so that lines like `int x = 3;` or `i < 3` are never touched.
      if (line.trim() === '3') {
        return line.replace('3', '}');
      }
      return line;
    });

  return processed.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

module.exports = { sanitizeOcrText, sanitizeOcrTextCode };
