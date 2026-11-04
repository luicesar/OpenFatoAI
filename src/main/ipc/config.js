'use strict';

// ── IPC: Config & API Key ────────────────────────────────────────

const { ipcMain, safeStorage, shell } = require('electron');
const { createLogger }                = require('../../services/logger');
const { userDataPath, readJsonSafe, writeJsonSafe, ok, fail } = require('../../shared/utils');
const { FILES, GEMINI_KEY_PATTERN, OPENAI_KEY_PATTERN, OPENAI_DEFAULT_MODEL, ANTHROPIC_KEY_PATTERN, ANTHROPIC_DEFAULT_MODEL, OPENCODEGO_KEY_PATTERN, OPENCODEGO_DEFAULT_MODEL } = require('../../shared/constants');

const log = createLogger('ipc:config');

// ── Internal helpers ─────────────────────────────────────────────

/**
 * Absolute path of an encrypted key file inside the userData folder.
 * @param {string} baseName  e.g. FILES.API_KEY ('api-key.enc')
 * @returns {string}
 */
function resolveKeyPath(baseName) {
  return userDataPath(baseName);
}

/**
 * Reads the encrypted API key from disk; returns '' on any error.
 * @returns {string}
 */
function readApiKey() {
  try {
    const fs   = require('fs');
    const p    = resolveKeyPath(FILES.API_KEY);
    if (!fs.existsSync(p)) return '';
    if (!safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(fs.readFileSync(p)) || '';
  } catch {
    return '';
  }
}

/**
 * Builds a full Gemini generateContent endpoint from the saved config.
 * @param {object} cfg
 * @returns {{ apiKey: string, model: string, endpoint: string }}
 */
function resolveGeminiConfig(cfg) {
  const { GEMINI_BASE_URL, GEMINI_DEFAULT_MODEL } = require('../../shared/constants');
  const apiKey   = readApiKey() || cfg.geminiApiKey || '';
  const model    = cfg.sourceAIModel || GEMINI_DEFAULT_MODEL;
  const baseUrl  = (process.env.GEMINI_API_URL || GEMINI_BASE_URL).replace(/\/$/, '');
  const endpoint = `${baseUrl}/${encodeURIComponent(model)}:generateContent`;
  return { apiKey, model, endpoint };
}

/**
 * Reads the encrypted OpenAI key from disk; returns '' on any error.
 * @returns {string}
 */
function readOpenAIKey() {
  try {
    const fs = require('fs');
    const p  = resolveKeyPath(FILES.OPENAI_KEY);
    if (!fs.existsSync(p)) return '';
    if (!safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(fs.readFileSync(p)) || '';
  } catch {
    return '';
  }
}

/**
 * Builds the OpenAI config object from the saved config.
 * @param {object} cfg
 * @returns {{ apiKey: string, model: string }}
 */
function resolveOpenAIConfig(cfg) {
  const apiKey = readOpenAIKey() || '';
  const model  = cfg.openaiModel || cfg.sourceAIModel || OPENAI_DEFAULT_MODEL;
  return { apiKey, model };
}

/**
 * Reads the encrypted OpenCode Go key from disk; returns '' on any error.
 * @returns {string}
 */
function readOpenCodeGoKey() {
  try {
    const fs = require('fs');
    const p  = resolveKeyPath(FILES.OPENCODEGO_KEY);
    if (!fs.existsSync(p)) return '';
    if (!safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(fs.readFileSync(p)) || '';
  } catch {
    return '';
  }
}

/**
 * Builds the OpenCode Go config object from the saved config.
 * @param {object} cfg
 * @returns {{ apiKey: string, model: string }}
 */
function resolveOpenCodeGoConfig(cfg) {
  const apiKey = readOpenCodeGoKey() || '';
  const model  = cfg.opencodegoModel || OPENCODEGO_DEFAULT_MODEL;
  return { apiKey, model };
}

/**
 * Reads the encrypted Anthropic key from disk; returns '' on any error.
 * @returns {string}
 */
function readAnthropicKey() {
  try {
    const fs = require('fs');
    const p  = resolveKeyPath(FILES.ANTHROPIC_KEY);
    if (!fs.existsSync(p)) return '';
    if (!safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(fs.readFileSync(p)) || '';
  } catch {
    return '';
  }
}

/**
 * Builds the Anthropic config object from the saved config.
 * @param {object} cfg
 * @returns {{ apiKey: string, model: string }}
 */
function resolveAnthropicConfig(cfg) {
  const apiKey = readAnthropicKey() || '';
  const model  = cfg.anthropicModel || ANTHROPIC_DEFAULT_MODEL;
  return { apiKey, model };
}

// ── Handlers ─────────────────────────────────────────────────────

function registerConfigHandlers() {
  // Save app config (shallow-merges with existing to avoid data loss)
  ipcMain.handle('save-config', async (_event, config) => {
    const existing = readJsonSafe(userDataPath(FILES.CONFIG), {});
    const merged   = { ...existing, ...config };
    const wrote    = writeJsonSafe(userDataPath(FILES.CONFIG), merged);
    if (!wrote) return fail('Failed to write config file');
    log.debug('Config saved');
    return ok();
  });

  // Load app config
  ipcMain.handle('load-config', async () => {
    const config = readJsonSafe(userDataPath(FILES.CONFIG), {});
    return ok({ config });
  });

  // Save Gemini API key via safeStorage
  ipcMain.handle('save-api-key', async (_event, key) => {
    if (!GEMINI_KEY_PATTERN.test(String(key))) {
      return fail('Invalid key format. Must start with "AIza" (39 chars) or "AQ." (new format).');
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return fail('safeStorage is unavailable on this system');
    }
    try {
      const fs  = require('fs');
      const enc = safeStorage.encryptString(String(key));
      fs.writeFileSync(resolveKeyPath(FILES.API_KEY), enc);
      log.info('API key saved via safeStorage');
      return ok();
    } catch (e) {
      log.error('Failed to save API key', { error: e.message });
      return fail(e);
    }
  });

  // Check whether an API key exists on disk
  ipcMain.handle('has-api-key', async () => {
    const fs  = require('fs');
    const has = fs.existsSync(resolveKeyPath(FILES.API_KEY));
    return ok({ has });
  });

  // Open Gemini API key page in the default browser
  ipcMain.handle('open-api-key-url', async () => {
    await shell.openExternal('https://aistudio.google.com/app/api-keys');
    return ok();
  });

  // ── OpenAI key handlers ──────────────────────────────────────────

  // Save OpenAI API key via safeStorage
  ipcMain.handle('save-openai-key', async (_event, key) => {
    if (!OPENAI_KEY_PATTERN.test(String(key))) {
      return fail('Invalid key format. Must start with "sk-" followed by at least 20 characters.');
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return fail('safeStorage is unavailable on this system');
    }
    try {
      const fs  = require('fs');
      const enc = safeStorage.encryptString(String(key));
      fs.writeFileSync(resolveKeyPath(FILES.OPENAI_KEY), enc);
      log.info('OpenAI key saved via safeStorage');
      return ok();
    } catch (e) {
      log.error('Failed to save OpenAI key', { error: e.message });
      return fail(e);
    }
  });

  // Check whether an OpenAI API key exists on disk
  ipcMain.handle('has-openai-key', async () => {
    const fs  = require('fs');
    const has = fs.existsSync(resolveKeyPath(FILES.OPENAI_KEY));
    return ok({ has });
  });

  // Open OpenAI API key page in the default browser
  ipcMain.handle('open-openai-key-url', async () => {
    await shell.openExternal('https://platform.openai.com/api-keys');
    return ok();
  });

  // ── OpenCode Go key handlers ─────────────────────────────────────

  // Save OpenCode Go API key via safeStorage
  ipcMain.handle('save-opencodego-key', async (_event, key) => {
    if (!OPENCODEGO_KEY_PATTERN.test(String(key))) {
      return fail('Invalid key format. The key must have at least 16 characters and no spaces.');
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return fail('safeStorage is unavailable on this system');
    }
    try {
      const fs  = require('fs');
      const enc = safeStorage.encryptString(String(key));
      fs.writeFileSync(resolveKeyPath(FILES.OPENCODEGO_KEY), enc);
      log.info('OpenCode Go key saved via safeStorage');
      return ok();
    } catch (e) {
      log.error('Failed to save OpenCode Go key', { error: e.message });
      return fail(e);
    }
  });

  // Check whether an OpenCode Go API key exists on disk
  ipcMain.handle('has-opencodego-key', async () => {
    const fs  = require('fs');
    const has = fs.existsSync(resolveKeyPath(FILES.OPENCODEGO_KEY));
    return ok({ has });
  });

  // Open the OpenCode console (where the Go key is created) in the default browser
  ipcMain.handle('open-opencodego-key-url', async () => {
    await shell.openExternal('https://opencode.ai/auth');
    return ok();
  });

  // ── Anthropic key handlers ───────────────────────────────────────

  // Save Anthropic API key via safeStorage
  ipcMain.handle('save-anthropic-key', async (_event, key) => {
    if (!ANTHROPIC_KEY_PATTERN.test(String(key))) {
      return fail('Invalid key format. Must start with "sk-ant-" followed by at least 20 characters.');
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return fail('safeStorage is unavailable on this system');
    }
    try {
      const fs  = require('fs');
      const enc = safeStorage.encryptString(String(key));
      fs.writeFileSync(resolveKeyPath(FILES.ANTHROPIC_KEY), enc);
      log.info('Anthropic key saved via safeStorage');
      return ok();
    } catch (e) {
      log.error('Failed to save Anthropic key', { error: e.message });
      return fail(e);
    }
  });

  // Check whether an Anthropic API key exists on disk
  ipcMain.handle('has-anthropic-key', async () => {
    const fs  = require('fs');
    const has = fs.existsSync(resolveKeyPath(FILES.ANTHROPIC_KEY));
    return ok({ has });
  });

  // Open Anthropic API key page in the default browser
  ipcMain.handle('open-anthropic-key-url', async () => {
    await shell.openExternal('https://platform.claude.com/settings/keys');
    return ok();
  });
}

module.exports = { registerConfigHandlers, resolveGeminiConfig, readApiKey, resolveOpenAIConfig, readOpenAIKey, resolveAnthropicConfig, readAnthropicKey, resolveOpenCodeGoConfig, readOpenCodeGoKey };
