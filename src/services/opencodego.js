'use strict';

// ── OpenCode Go — REST client ────────────────────────────────────
// OpenCode Go exposes OpenAI-compatible Chat Completions, so this reuses the OpenAI client
// with a different base URL. It has no audio endpoint: callers transcribe audio first.

const crypto = require('crypto');
const { sendToOpenAI } = require('./openai');
const { OPENCODEGO_BASE_URL, OPENCODEGO_DEFAULT_MODEL, APP_VERSION } = require('../shared/constants');

// OpenCode Go asks for a stable session id (routing/prompt caching) and an own user agent.
const SESSION_ID = crypto.randomUUID();

/**
 * item: { kind: 'text'|'screenshot', payload }
 * cfg:  { apiKey, model }
 */
function sendToOpenCodeGo(item, cfg, options = {}) {
  if (item.kind === 'audio') throw new Error('OpenCode Go does not accept audio. Transcribe it first.');
  return sendToOpenAI(
    item,
    {
      apiKey   : cfg?.apiKey,
      model    : cfg?.model || OPENCODEGO_DEFAULT_MODEL,
      baseUrl  : OPENCODEGO_BASE_URL,
      label    : 'OpenCode Go',
      maxTokens: 4096, // reasoning models spend part of the budget on thinking
      extraHeaders: { 'x-opencode-session': SESSION_ID, 'User-Agent': `openfatoai/${APP_VERSION}` },
    },
    options,
  );
}

module.exports = { sendToOpenCodeGo };
