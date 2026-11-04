'use strict';

// ── IPC: AI send handlers (Gemini + OpenAI + Anthropic + OpenCode Go) ──────────────────

const { ipcMain }             = require('electron');
const { sendToGemini }        = require('../../services/gemini');
const { sendToOpenAI, transcribeWithWhisper } = require('../../services/openai');
const { sendToAnthropic }     = require('../../services/anthropic');
const { sendToOpenCodeGo }    = require('../../services/opencodego');
const { createLogger }        = require('../../services/logger');
const { userDataPath, readJsonSafe, ok, fail } = require('../../shared/utils');
const { resolveGeminiConfig, resolveOpenAIConfig, resolveAnthropicConfig, resolveOpenCodeGoConfig } = require('./config');
const { FILES }               = require('../../shared/constants');

const log = createLogger('ipc:ai');

// ── Internal helper ───────────────────────────────────────────────

/** Loads config and validates that an API key is present. */
function _loadCfg() {
  return readJsonSafe(userDataPath(FILES.CONFIG), {});
}

function _requireApiKey(cfg) {
  const { apiKey, endpoint } = resolveGeminiConfig(cfg);
  if (!apiKey) throw new Error('Gemini API key not configured. Go to AI Sources → Gemini AI and enter your key.');
  return { apiKey, endpoint };
}

function _requireOpenAIKey(cfg) {
  const { apiKey, model } = resolveOpenAIConfig(cfg);
  if (!apiKey) throw new Error('OpenAI API key not configured. Go to AI Sources → OpenAI and enter your key.');
  return { apiKey, model };
}

function _requireAnthropicKey(cfg) {
  const { apiKey, model } = resolveAnthropicConfig(cfg);
  if (!apiKey) throw new Error('Anthropic API key not configured. Go to AI Sources → Anthropic AI and enter your key.');
  return { apiKey, model };
}

function _requireOpenCodeGoKey(cfg) {
  const { apiKey, model } = resolveOpenCodeGoConfig(cfg);
  if (!apiKey) throw new Error('OpenCode Go API key not configured. Go to AI Sources → OpenCode Go and enter your key.');
  return { apiKey, model };
}

/**
 * Providers without an audio endpoint (Anthropic, OpenCode Go) get a transcript first:
 * OpenAI Whisper when a key exists, otherwise Gemini.
 */
async function _transcribeAudio(cfg, payload, providerName) {
  const openaiCfg = resolveOpenAIConfig(cfg);
  if (openaiCfg.apiKey) return transcribeWithWhisper(payload, openaiCfg.apiKey);

  const geminiCfg = resolveGeminiConfig(cfg);
  if (!geminiCfg.apiKey) {
    throw new Error(
      `Para usar gravação de áudio com ${providerName}, configure uma chave OpenAI (Whisper) ou Gemini para transcrição.`
    );
  }
  const geminiRes = await sendToGemini(
    { kind: 'audio', payload },
    { endpoint: geminiCfg.endpoint, apiKey: geminiCfg.apiKey },
    { prompt: 'Transcreva este áudio exatamente como falado. Retorne apenas o texto transcrito, sem análise ou comentários adicionais.' },
  );
  return geminiRes?.json?.candidates?.[0]?.content?.parts?.[0]?.text || geminiRes?.body || '';
}

// ── Handlers ─────────────────────────────────────────────────────

function registerAiHandlers() {
  // Send audio recording
  ipcMain.handle('send-audio', async (_event, payload) => {
    try {
      const cfg      = _loadCfg();
      const provider = cfg.activeAiSource || 'gemini';
      let result;

      if (provider === 'openai') {
        const { apiKey, model } = _requireOpenAIKey(cfg);
        result = await sendToOpenAI(
          { kind: 'audio', payload },
          { apiKey, model },
          { prompt: cfg.sourceAIPrompt || null },
        );
      } else if (provider === 'opencodego') {
        const { apiKey, model } = _requireOpenCodeGoKey(cfg);
        const userPrompt = cfg.sourceAIPrompt || 'Provide concise suggested answers and key points.';
        const transcript = await _transcribeAudio(cfg, payload, 'OpenCode Go');
        result = await sendToOpenCodeGo(
          { kind: 'text', payload: { text: `${userPrompt}\n\nTranscrição do áudio:\n"${transcript}"` } },
          { apiKey, model },
        );
      } else if (provider === 'anthropic') {
        const { apiKey, model } = _requireAnthropicKey(cfg);
        const userPrompt = cfg.sourceAIPrompt || 'Provide concise suggested answers and key points.';

        // Anthropic does not support audio — transcribe first, then send text.
        const transcript = await _transcribeAudio(cfg, payload, 'Claude');

        result = await sendToAnthropic(
          { kind: 'text', payload: { text: `${userPrompt}\n\nTranscrição do áudio:\n"${transcript}"` } },
          { apiKey, model },
        );
      } else {
        const { apiKey, endpoint } = _requireApiKey(cfg);
        result = await sendToGemini(
          { kind: 'audio', payload },
          { endpoint, apiKey },
          { prompt: cfg.sourceAIPrompt || null },
        );
      }

      return ok({ result });
    } catch (e) {
      log.error('send-audio failed', { error: e.message });
      return fail(e);
    }
  });

  // Send screenshot data URL
  ipcMain.handle('send-screenshot', async (_event, payload) => {
    try {
      const cfg      = _loadCfg();
      const provider = cfg.activeAiSource || 'gemini';
      if (provider === 'openai') {
        const { apiKey, model } = _requireOpenAIKey(cfg);
        const result = await sendToOpenAI(
          { kind: 'screenshot', payload },
          { apiKey, model },
          { prompt: cfg.sourceAIPrompt || null },
        );
        return ok({ result });
      }
      if (provider === 'opencodego') {
        const { apiKey, model } = _requireOpenCodeGoKey(cfg);
        const result = await sendToOpenCodeGo(
          { kind: 'screenshot', payload },
          { apiKey, model },
          { prompt: cfg.sourceAIPrompt || null },
        );
        return ok({ result });
      }
      if (provider === 'anthropic') {
        const { apiKey, model } = _requireAnthropicKey(cfg);
        const result = await sendToAnthropic(
          { kind: 'screenshot', payload },
          { apiKey, model },
          { prompt: cfg.sourceAIPrompt || null },
        );
        return ok({ result });
      }
      const { apiKey, endpoint } = _requireApiKey(cfg);
      const result = await sendToGemini(
        { kind: 'screenshot', payload },
        { endpoint, apiKey },
        { prompt: cfg.sourceAIPrompt || null },
      );
      return ok({ result });
    } catch (e) {
      log.error('send-screenshot failed', { error: e.message });
      return fail(e);
    }
  });

  // Send captured text
  ipcMain.handle('send-text', async (_event, payload) => {
    try {
      const cfg      = _loadCfg();
      const provider = cfg.activeAiSource || 'gemini';
      if (payload.model) {
        cfg.sourceAIModel  = payload.model; // Gemini  (resolveGeminiConfig  → cfg.sourceAIModel)
        cfg.openaiModel    = payload.model; // OpenAI  (resolveOpenAIConfig   → cfg.openaiModel)
        cfg.anthropicModel = payload.model; // Anthropic (resolveAnthropicConfig → cfg.anthropicModel)
        cfg.opencodegoModel = payload.model; // OpenCode Go (resolveOpenCodeGoConfig → cfg.opencodegoModel)
      }
      const prompt       = payload.prompt || cfg.sourceAIPrompt || '';
      const combinedText = prompt ? `${prompt}\n\n${payload.text || ''}` : (payload.text || '');

      let result;
      if (provider === 'openai') {
        const { apiKey, model } = _requireOpenAIKey(cfg);
        result = await sendToOpenAI(
          { kind: 'text', payload: { text: combinedText } },
          { apiKey, model },
          {},
        );
      } else if (provider === 'opencodego') {
        const { apiKey, model } = _requireOpenCodeGoKey(cfg);
        result = await sendToOpenCodeGo(
          { kind: 'text', payload: { text: combinedText } },
          { apiKey, model },
          {},
        );
      } else if (provider === 'anthropic') {
        const { apiKey, model } = _requireAnthropicKey(cfg);
        result = await sendToAnthropic(
          { kind: 'text', payload: { text: combinedText } },
          { apiKey, model },
          {},
        );
      } else {
        const { apiKey, endpoint } = _requireApiKey(cfg);
        result = await sendToGemini(
          { kind: 'text', payload: { text: combinedText } },
          { endpoint, apiKey },
          {},
        );
      }

      return ok({ result });
    } catch (e) {
      log.error('send-text failed', { error: e.message });
      return fail(e);
    }
  });
}

module.exports = { registerAiHandlers };
