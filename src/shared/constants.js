'use strict';

// ── App identity ────────────────────────────────────────────────
const APP_NAME    = 'OpenFatoAI';
const APP_VERSION = '0.1.2';
const GITHUB_REPO = 'luicesar/OpenFatoAI';

// ── Gemini defaults ─────────────────────────────────────────────
const GEMINI_BASE_URL      = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_DEFAULT_MODEL = 'gemini-3.6-flash';
const GEMINI_KEY_PATTERN   = /^(?:AIza[0-9A-Za-z_\-]{35}|AQ\.[0-9A-Za-z_\-]{30,})$/;

// ── OpenAI defaults ──────────────────────────────────────────────
const OPENAI_BASE_URL      = 'https://api.openai.com/v1';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
const OPENAI_KEY_PATTERN   = /^sk-[A-Za-z0-9_\-]{20,}$/;

// ── Anthropic defaults ───────────────────────────────────────────
const ANTHROPIC_BASE_URL      = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION       = '2023-06-01';
const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_KEY_PATTERN   = /^sk-ant-[A-Za-z0-9_\-]{20,}$/;

// ── OpenCode Go defaults ─────────────────────────────────────────
const OPENCODEGO_BASE_URL      = 'https://opencode.ai/inference/go/openai/v1';
const OPENCODEGO_DEFAULT_MODEL = 'kimi-k3';
const OPENCODEGO_KEY_PATTERN   = /^\S{16,}$/;

// ── Whisper (local transcription) profiles ───────────────────────
// Config key `whisperModel` holds one of these keys; models are quantized ONNX from Xenova.
// whisper-medium is intentionally absent: it needs ~9 GB of RAM and gets OOM-killed on typical PCs.
// `precise` is NVIDIA Parakeet TDT v3 (int8) run through sherpa-onnx, not transformers.js:
// the worker picks the engine from the id prefix.
const WHISPER_MODELS = Object.freeze({
  fast:     'Xenova/whisper-base',
  balanced: 'Xenova/whisper-small',
  precise:  'parakeet-tdt-0.6b-v3-int8',
});
const WHISPER_DEFAULT_PROFILE = 'balanced';

// ── Project support link (opened in the default browser) ─────────
const SUPPORT_URL = 'https://buymeacoffee.com/fatosystem7';

// ── IPC channel names (single source of truth) ──────────────────
const IPC = Object.freeze({
  HIDE_WINDOW:            'hide-window',
  SAVE_CONFIG:            'save-config',
  LOAD_CONFIG:            'load-config',
  SAVE_API_KEY:           'save-api-key',
  HAS_API_KEY:            'has-api-key',
  OPEN_API_KEY_URL:       'open-api-key-url',
  SEND_AUDIO:             'send-audio',
  SEND_SCREENSHOT:        'send-screenshot',
  SEND_TEXT:              'send-text',
  CAPTURE_SCREEN:         'capture-screen-desktop',
  CAPTURE_OCR:            'capture-and-ocr',
  CAPTURE_REGION_OCR:     'capture-region-and-ocr',
  GET_SELECTOR_SHOT:      'get-selector-screenshot',
  REGION_SELECTED:        'region-selected',
  REGION_CANCELLED:       'region-cancelled',
  WINDOW_MINIMIZE:        'window:minimize',
  WINDOW_MAXIMIZE_TOGGLE: 'window:maximize-toggle',
  WINDOW_CLOSE:           'window:close',
  WINDOW_QUIT:            'window:quit',
  GET_APP_VERSION:        'get-app-version',
  UPDATE_CHECK:               'update:check',
  UPDATE_AVAILABLE:           'update:available',
  SHELL_OPEN_EXTERNAL:        'shell:open-external',
});

// ── Safe-storage / config file names ────────────────────────────
const FILES = Object.freeze({
  CONFIG:        'config.json',
  API_KEY:       'api-key.enc',
  OPENAI_KEY:    'openai-key.enc',
  ANTHROPIC_KEY: 'anthropic-key.enc',
  OPENCODEGO_KEY: 'opencodego-key.enc',
});

// ── Global shortcut ─────────────────────────────────────────────
const GLOBAL_SHORTCUT = 'CmdOrCtrl+Shift+F9';

// ── OCR / Tesseract ─────────────────────────────────────────────
const TESSERACT_ATTEMPTS = [
  ['-l', 'por+eng', '--psm', '6'],
  ['-l', 'eng',     '--psm', '6'],
  [],
];

const TESSERACT_CODE_ATTEMPTS = [
  ['-l', 'eng',     '--psm', '6', '--oem', '1',
   '-c', 'preserve_interword_spaces=1',
   '-c', 'tessedit_char_whitelist='],
  ['-l', 'por+eng', '--psm', '6', '--oem', '1',
   '-c', 'preserve_interword_spaces=1',
   '-c', 'tessedit_char_whitelist='],
  ['-l', 'eng',     '--psm', '4', '--oem', '1',
   '-c', 'preserve_interword_spaces=1'],
];

module.exports = {
  APP_NAME,
  APP_VERSION,
  GITHUB_REPO,
  SUPPORT_URL,
  WHISPER_MODELS,
  WHISPER_DEFAULT_PROFILE,
  GEMINI_BASE_URL,
  GEMINI_DEFAULT_MODEL,
  GEMINI_KEY_PATTERN,
  OPENAI_BASE_URL,
  OPENAI_DEFAULT_MODEL,
  OPENAI_KEY_PATTERN,
  OPENCODEGO_BASE_URL,
  OPENCODEGO_DEFAULT_MODEL,
  OPENCODEGO_KEY_PATTERN,
  ANTHROPIC_BASE_URL,
  ANTHROPIC_VERSION,
  ANTHROPIC_DEFAULT_MODEL,
  ANTHROPIC_KEY_PATTERN,
  IPC,
  FILES,
  GLOBAL_SHORTCUT,
  TESSERACT_ATTEMPTS,
  TESSERACT_CODE_ATTEMPTS,
};
