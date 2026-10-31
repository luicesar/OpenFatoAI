'use strict';

// ── IPC: Screen capture & OCR ────────────────────────────────────

const { ipcMain, desktopCapturer, screen: electronScreen, BrowserWindow, nativeImage } = require('electron');
const { execFile, execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const { createLogger }    = require('../../services/logger');
const { sanitizeOcrText, sanitizeOcrTextCode } = require('../../services/ocr');
const { tempFilePath, unlinkSafe, ok, fail } = require('../../shared/utils');
const { TESSERACT_ATTEMPTS, TESSERACT_CODE_ATTEMPTS } = require('../../shared/constants');

const log = createLogger('ipc:screen');

// ── Shared state ─────────────────────────────────────────────────
// win reference injected via init() so this module stays decoupled from main.
let _win = null;
let _selectorScreenshotDataUrl = null;
let _selectorResolve           = null;

/** @param {import('electron').BrowserWindow | null} win */
function init(win) { _win = win; }

// ── Internal helpers ──────────────────────────────────────────────

/**
 * Resolves the tesseract binary path.
 * On Windows, falls back to common UB Mannheim install locations when
 * 'tesseract' is not on PATH. On other platforms, returns 'tesseract'
 * unchanged (no regression).
 * Resolved once at module load via fs.existsSync.
 * @returns {string}
 */
function _resolveTesseractBin() {
  if (process.platform !== 'win32') return 'tesseract';

  const candidates = [
    process.env['ProgramFiles']      && path.join(process.env['ProgramFiles'],      'Tesseract-OCR', 'tesseract.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Tesseract-OCR', 'tesseract.exe'),
    process.env['LOCALAPPDATA']      && path.join(process.env['LOCALAPPDATA'],      'Programs', 'Tesseract-OCR', 'tesseract.exe'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  // Not found in common install locations — return 'tesseract' so the
  // existing PATH-based execFile call still runs and produces ENOENT,
  // which is then mapped to TESSERACT_NOT_FOUND by the callers.
  return 'tesseract';
}

const TESSERACT_BIN = _resolveTesseractBin();

async function _hideAndWait(ms = 800) {
  const wasVisible = _win?.isVisible() ?? false;
  try { if (_win && wasVisible) _win.hide(); } catch (_) {}
  await new Promise((r) => setTimeout(r, ms));
  return wasVisible;
}

function _restoreWin(wasVisible) {
  try { if (_win && wasVisible) _win.show(); } catch (_) {}
}

/**
 * Detects whether the image has a dark background using ImageMagick 'convert'.
 * Returns true if average luminosity < 128 (dark background).
 * Falls back to false if ImageMagick is not available.
 * @param {string} imgPath
 * @returns {boolean}
 */
function _isDarkBackground(imgPath) {
  try {
    const result = spawnSync(
      'convert',
      [imgPath, '-colorspace', 'Gray', '-format', '%[fx:mean*255]', 'info:'],
      { encoding: 'utf8', timeout: 5000 },
    );
    if (result.status !== 0 || !result.stdout) return _isDarkBackgroundNative(imgPath);
    const mean = parseFloat(result.stdout.trim());
    if (isNaN(mean)) return _isDarkBackgroundNative(imgPath);
    return mean < 128;
  } catch (_) {
    return _isDarkBackgroundNative(imgPath);
  }
}

/**
 * Detects dark background using Electron's nativeImage (no external tools needed).
 * Samples every 20th pixel from the BGRA bitmap and computes average luminosity.
 * Returns true if average luminosity < 128.
 * @param {string} imgPath
 * @returns {boolean}
 */
function _isDarkBackgroundNative(imgPath) {
  try {
    const img  = nativeImage.createFromPath(imgPath);
    const buf  = img.getBitmap();   // raw BGRA buffer
    let sum = 0;
    let count = 0;
    for (let i = 0; i < buf.length; i += 4 * 20) {  // sample every 20th pixel
      const b = buf[i];
      const g = buf[i + 1];
      const r = buf[i + 2];
      // Rec. 601 luminance approximation
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }
    if (count === 0) return false;
    return (sum / count) < 128;
  } catch (_) {
    return false;
  }
}

/**
 * Pre-processes an image for code OCR using nativeImage (no ImageMagick required).
 * Pipeline: grayscale → normalize (stretch contrast to [0, 255]) → threshold (> 128 → white).
 * Writes result as PNG to outPath.
 * Returns true on success, false on failure.
 * @param {string} imgPath
 * @param {string} outPath
 * @returns {boolean}
 */
function _preprocessForCodeOcrNative(imgPath, outPath) {
  try {
    const img    = nativeImage.createFromPath(imgPath);
    const size   = img.getSize();
    const src    = img.getBitmap();   // BGRA
    const dst    = Buffer.alloc(src.length);

    // Pass 1: compute luminance range for normalization
    let minL = 255;
    let maxL = 0;
    for (let i = 0; i < src.length; i += 4) {
      const b = src[i]; const g = src[i + 1]; const r = src[i + 2];
      const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      if (l < minL) minL = l;
      if (l > maxL) maxL = l;
    }
    const range = maxL - minL || 1;   // avoid division by zero

    // Pass 2: grayscale + normalize + threshold → binary (white bg, black text)
    for (let i = 0; i < src.length; i += 4) {
      const b = src[i]; const g = src[i + 1]; const r = src[i + 2];
      const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      const norm = Math.round(((l - minL) / range) * 255);
      // After normalization, bright pixels (originally light) → near 255.
      // In a dark-bg image the text is light → after normalization it is near 255.
      // Invert so text → black (low value), background → white (255).
      const out = norm > 128 ? 0 : 255;
      dst[i]     = out;   // B
      dst[i + 1] = out;   // G
      dst[i + 2] = out;   // R
      dst[i + 3] = 255;   // A
    }

    const processed = nativeImage.createFromBitmap(dst, { width: size.width, height: size.height });
    fs.writeFileSync(outPath, processed.toPNG());
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Detects mixed light/dark content (e.g. a bright page with a dark code block).
 * Samples every 20th pixel using BGRA bitmap; classifies pixels as very dark (lum < 64)
 * or very bright (lum > 192) using Rec. 601 luminance.
 * Returns true if:
 *   darkRatio  > 0.10  (at least 10% very dark pixels)
 *   darkRatio  < 0.65  (not a fully dark image — handled by _isDarkBackground)
 *   brightRatio > 0.35  (at least 35% very bright pixels)
 * Returns false on any exception.
 * @param {string} imgPath
 * @returns {boolean}
 */
function _hasMixedContent(imgPath) {
  try {
    const img  = nativeImage.createFromPath(imgPath);
    const buf  = img.getBitmap();   // raw BGRA
    let darkPx   = 0;
    let brightPx = 0;
    let total    = 0;
    for (let i = 0; i < buf.length; i += 4 * 20) {
      const b = buf[i];
      const g = buf[i + 1];
      const r = buf[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 64)  darkPx++;
      if (lum > 192) brightPx++;
      total++;
    }
    if (total === 0) return false;
    const darkRatio   = darkPx   / total;
    const brightRatio = brightPx / total;
    return darkRatio > 0.10 && darkRatio < 0.65 && brightRatio > 0.35;
  } catch (_) {
    return false;
  }
}

/**
 * Pre-processes an image for code OCR on dark backgrounds.
 * Tries ImageMagick first (grayscale + normalize + threshold); falls back to nativeImage.
 * Returns the path of the processed image on success, or null on failure.
 * Caller is responsible for unlinking the returned path.
 * @param {string} imgPath
 * @returns {string | null}
 */
function _preprocessForCodeOcr(imgPath) {
  const outPath = imgPath.replace(/\.png$/, '-pre.png');
  try {
    const result = spawnSync(
      'convert',
      [imgPath, '-colorspace', 'Gray', '-normalize', '-threshold', '50%', outPath],
      { timeout: 5000 },
    );
    if (result.status === 0) return outPath;
  } catch (_) { /* ImageMagick unavailable — fall through */ }

  // Fallback: pure-Node pipeline via nativeImage
  const succeeded = _preprocessForCodeOcrNative(imgPath, outPath);
  return succeeded ? outPath : null;
}

/**
 * Runs tesseract with fallback attempt list.
 * @param {string} imgPath
 * @returns {Promise<string>}
 */
async function _runOcrFallbacks(imgPath) {
  let finalOut = '';
  let lastErr  = null;

  for (const extraArgs of TESSERACT_ATTEMPTS) {
    const args = [imgPath, 'stdout', ...extraArgs];
    try {
      const out = await new Promise((res, rej) =>
        execFile(TESSERACT_BIN, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
          (err, stdout, stderr) => err ? rej({ err, stderr }) : res(stdout || ''),
        ),
      );
      const trimmed = out.trim();
      if (trimmed.length > 8) { finalOut = trimmed; break; }
      if (!finalOut) finalOut = trimmed;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!finalOut && lastErr?.err?.code === 'ENOENT') {
    throw new Error('TESSERACT_NOT_FOUND');
  }
  return finalOut;
}

/**
 * Runs Tesseract with code-optimised settings and minimal sanitisation.
 * Pre-processes dark-background images by inverting colours first.
 * Falls back to standard _runOcrFallbacks if code attempts yield empty output.
 * @param {string} imgPath
 * @returns {Promise<{ raw: string, mode: 'code' | 'standard' }>}
 */
async function _runCodeOcrFallbacks(imgPath) {
  let workPath     = imgPath;
  let invertedPath = null;

  try {
    if (_isDarkBackground(imgPath)) {
      invertedPath = _preprocessForCodeOcr(imgPath);
      if (invertedPath) {
        workPath = invertedPath;
        log.debug('Dark background detected — using preprocessed image for OCR');
      }
    }

    let finalOut = '';
    let lastErr  = null;

    for (const extraArgs of TESSERACT_CODE_ATTEMPTS) {
      const args = [workPath, 'stdout', ...extraArgs];
      try {
        const out = await new Promise((res, rej) =>
          execFile(TESSERACT_BIN, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
            (err, stdout, stderr) => err ? rej({ err, stderr }) : res(stdout || ''),
          ),
        );
        const trimmed = out.trimEnd();
        if (trimmed.length > 4) { finalOut = trimmed; break; }
        if (!finalOut) finalOut = trimmed;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!finalOut && lastErr?.err?.code === 'ENOENT') {
      throw new Error('TESSERACT_NOT_FOUND');
    }

    // If code attempts yielded nothing meaningful, fall back to standard
    if (!finalOut || finalOut.trim().length < 4) {
      const stdRaw = await _runOcrFallbacks(workPath);
      return { raw: stdRaw, mode: 'standard' };
    }

    return { raw: finalOut, mode: 'code' };
  } finally {
    if (invertedPath) unlinkSafe(invertedPath);
  }
}

/**
 * Takes a full-screen screenshot and writes it to tmpPath.
 * Returns true on success, throws on unrecoverable failure.
 * @param {string} tmpPath
 */
async function _captureScreen(tmpPath) {
  const platform    = process.platform;
  let usedMethod    = null;
  const wasVisible  = await _hideAndWait(800);

  try {
    if (platform === 'darwin') {
      await new Promise((res, rej) =>
        execFile('screencapture', ['-x', '-S', tmpPath], (err) => (err ? rej(err) : res())),
      );
      usedMethod = 'screencapture';
    } else if (platform === 'linux') {
      try {
        const scrotPath = execSync('which scrot', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (scrotPath) {
          await new Promise((res, rej) =>
            execFile(scrotPath, ['-u', tmpPath], (err) => (err ? rej(err) : res())),
          );
          usedMethod = 'scrot';
        }
      } catch (_) { /* scrot not installed — fall through */ }
    }

    if (!usedMethod) {
      const screenshot = require('screenshot-desktop');
      const buf = await screenshot({ format: 'png' });
      fs.writeFileSync(tmpPath, buf);
      usedMethod = 'screenshot-desktop';
    }
  } finally {
    _restoreWin(wasVisible);
  }

  log.debug(`Screen captured via ${usedMethod}`);
}

/**
 * Heuristic: returns true if the line looks like source code.
 * Checks for identifier chains, curly/square brackets, programming keywords, semicolons.
 * @param {string} line
 * @returns {boolean}
 */
function _looksLikeCode(line) {
  if (!line || !line.trim()) return false;
  // Identifier chain: foo.Bar, Console.WriteLine, obj.method
  if (/[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_]/.test(line)) return true;
  // Curly or square brackets (structural delimiters)
  if (/[{}\[\]]/.test(line)) return true;
  // Common programming keywords
  if (/\b(string|int|bool|void|static|class|public|private|protected|var|const|let|return|if|else|for|while|new|null|true|false)\b/.test(line)) return true;
  // Semicolons (statement terminators)
  if (/;/.test(line)) return true;
  return false;
}

// ── Handlers ─────────────────────────────────────────────────────

function registerScreenHandlers() {
  // capture-screen-desktop: OS-level screenshot as data URL
  ipcMain.handle('capture-screen-desktop', async () => {
    try {
      const screenshot = require('screenshot-desktop');
      const buf = await screenshot({ format: 'png' });
      return ok({ dataUrl: `data:image/png;base64,${buf.toString('base64')}` });
    } catch (e) {
      log.error('capture-screen-desktop failed', { error: e.message });
      return fail(e);
    }
  });

  // capture-and-ocr: full-screen screenshot → Tesseract
  ipcMain.handle('capture-and-ocr', async (_event, placeholders = []) => {
    const tmpPath = tempFilePath('openfatoai-snap', '.png');
    let procPath  = null;
    try {
      await _captureScreen(tmpPath);
      let ocrPath = tmpPath;

      const isDark  = _isDarkBackground(tmpPath);
      const isMixed = !isDark && _hasMixedContent(tmpPath);

      if (isDark || isMixed) {
        procPath = _preprocessForCodeOcr(tmpPath);
        if (procPath) {
          if (isDark) ocrPath = procPath;
          log.debug(`capture-and-ocr: ${isDark ? 'dark' : 'mixed'} content detected — preprocessed image ready`);
        }
      }

      // Pass principal: imagem original (ou pré-processada para caso dark puro)
      const rawOrig     = await _runOcrFallbacks(ocrPath);
      const cleanedOrig = sanitizeOcrText(rawOrig, placeholders);

      // Pass secundário (apenas mixed content): extrair código do bloco dark
      let finalText = cleanedOrig;
      if (isMixed && procPath) {
        const rawProc = await _runOcrFallbacks(procPath);
        const codeLines = sanitizeOcrTextCode(rawProc)
          .split('\n')
          .filter(_looksLikeCode)
          .filter((line) => {
            // deduplicar: descartar linhas que já existem no resultado principal
            return !cleanedOrig.split('\n').some(
              (existing) => existing.trim().toLowerCase() === line.trim().toLowerCase(),
            );
          });
        if (codeLines.length > 0) {
          finalText = cleanedOrig + '\n' + codeLines.join('\n');
        }
      }

      log.debug('OCR preview', { preview: finalText.split('\n').slice(0, 4).join(' | ') });
      return ok({ text: finalText });
    } catch (e) {
      log.error('capture-and-ocr failed', { error: e.message });
      return fail(e);
    } finally {
      unlinkSafe(tmpPath);
      if (procPath) unlinkSafe(procPath);
    }
  });

  // get-selector-screenshot: shares the stored screenshot with the selector overlay
  ipcMain.handle('get-selector-screenshot', () => _selectorScreenshotDataUrl);

  // capture-region-and-ocr: fullscreen overlay → user draws rect → Tesseract on crop
  ipcMain.handle('capture-region-and-ocr', async (_event, placeholders = []) => {
    try {
      const primary     = electronScreen.getPrimaryDisplay();
      const { width, height } = primary.size;
      const scale       = primary.scaleFactor || 1;
      const physW       = Math.round(width  * scale);
      const physH       = Math.round(height * scale);

      const wasVisible  = await _hideAndWait(200);

      // Capture full screen via desktopCapturer (works without external tools)
      let screenshotDataUrl = null;
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: physW, height: physH },
        });
        if (sources?.length) screenshotDataUrl = sources[0].thumbnail.toDataURL();
      } catch (e) {
        log.error('desktopCapturer failed', { error: e.message });
      }

      if (!screenshotDataUrl) {
        _restoreWin(wasVisible);
        return fail('Could not capture screen. Check screen-recording permissions.');
      }

      _selectorScreenshotDataUrl = screenshotDataUrl;

      // Open fullscreen selection overlay
      const selectorWin = new BrowserWindow({
        fullscreen   : true,
        frame        : false,
        alwaysOnTop  : true,
        skipTaskbar  : true,
        webPreferences: {
          preload          : path.join(__dirname, '..', 'preload-selector.js'),
          contextIsolation : true,
          nodeIntegration  : false,
        },
      });
      selectorWin.loadFile(path.join(__dirname, '..', '..', 'renderer', 'selector.html'));

      const selectionResult = await new Promise((resolve) => {
        _selectorResolve = resolve;
        ipcMain.once('region-selected', (_ev, croppedDataUrl) => {
          if (_selectorResolve) { _selectorResolve({ ok: true, dataUrl: croppedDataUrl }); _selectorResolve = null; }
        });
        ipcMain.once('region-cancelled', () => {
          if (_selectorResolve) { _selectorResolve({ ok: false }); _selectorResolve = null; }
        });
        selectorWin.once('closed', () => {
          if (_selectorResolve) { _selectorResolve({ ok: false }); _selectorResolve = null; }
        });
      });

      try { selectorWin.destroy(); } catch (_) {}
      _selectorScreenshotDataUrl = null;
      _restoreWin(wasVisible);

      if (!selectionResult.ok) return fail('Region selection cancelled.');

      // Write cropped PNG and run OCR
      const tmpPath = tempFilePath('openfatoai-region', '.png');
      const base64  = selectionResult.dataUrl.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(tmpPath, Buffer.from(base64, 'base64'));

      try {
        const { raw, mode } = await _runCodeOcrFallbacks(tmpPath);
        const cleaned = mode === 'code'
          ? sanitizeOcrTextCode(raw)
          : sanitizeOcrText(raw, placeholders);
        log.debug('Region OCR preview', { mode, preview: cleaned.split('\n').slice(0, 4).join(' | ') });
        return ok({ text: cleaned });
      } finally {
        unlinkSafe(tmpPath);
      }
    } catch (e) {
      log.error('capture-region-and-ocr failed', { error: e.message });
      return fail(e);
    }
  });
}

module.exports = { registerScreenHandlers, init };
