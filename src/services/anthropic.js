'use strict';

// ── Anthropic Messages API — REST client ─────────────────────────
// Uses fetch directly (no SDK dependency) for consistency with gemini.js / openai.js.

const { ANTHROPIC_BASE_URL, ANTHROPIC_VERSION } = require('../shared/constants');

const DEFAULT_RETRIES    = 1;
const DEFAULT_BACKOFF_MS = 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getFetch() {
  if (globalThis.fetch) return globalThis.fetch.bind(globalThis);
  try {
    return require('node-fetch');
  } catch {
    throw new Error('fetch is not available. Use Node 18+ or install node-fetch');
  }
}

/**
 * Send an item to the Anthropic Messages endpoint.
 * item: { kind: 'text'|'screenshot'|'audio', payload }
 * cfg:  { apiKey, model }
 * options: { prompt?, retries? }
 */
async function sendToAnthropic(item, cfg, options = {}) {
  if (!cfg?.apiKey) throw new Error('Anthropic API key not configured. Go to AI Sources → Anthropic AI and enter your key.');

  const fetchFn  = await getFetch();
  const model    = cfg.model || 'claude-sonnet-4-6';
  const endpoint = `${ANTHROPIC_BASE_URL}/messages`;
  const maxTries = options.retries ?? DEFAULT_RETRIES;

  // Build the user message content
  let userContent;

  if (item.kind === 'screenshot') {
    const dataUrl = item.payload?.dataUrl || '';
    if (!dataUrl.startsWith('data:image/')) throw new Error('Invalid dataUrl for screenshot');

    // Extract base64 and media type from data URL
    const [header, data] = dataUrl.split(',');
    const mediaType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const systemPrompt = options.prompt || 'Describe this image and provide short suggested answers for exam questions.';

    userContent = [
      {
        type  : 'image',
        source: { type: 'base64', media_type: mediaType, data },
      },
      { type: 'text', text: systemPrompt },
    ];

  } else if (item.kind === 'audio') {
    // Anthropic Messages API does not support audio input.
    throw new Error(
      'O Claude (Anthropic) não suporta processamento de áudio diretamente. ' +
      'Use o modo de captura de texto ou screenshot com Claude, ' +
      'ou mude para Gemini/OpenAI para sessões de gravação de áudio.'
    );

  } else {
    // text
    userContent = item.payload?.text || JSON.stringify(item.payload);
  }

  const body = {
    model,
    max_tokens : cfg.maxTokens || 1024,
    messages   : [{ role: 'user', content: userContent }],
  };

  const headers = {
    'Content-Type'    : 'application/json',
    'x-api-key'       : cfg.apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
  };

  let attempt   = 0;
  let lastError = null;

  while (attempt < maxTries) {
    attempt++;
    try {
      const res = await fetchFn(endpoint, {
        method : 'POST',
        headers,
        body   : JSON.stringify(body),
      });

      if (res.ok) {
        const text   = await res.text();
        let parsed   = null;
        try { parsed = JSON.parse(text); } catch { /* keep null */ }
        return { status: res.status, body: text, json: parsed };
      }

      // 429 — rate limit / overloaded
      if (res.status === 429 || res.status === 529) {
        const errBody    = await res.text().catch(() => '');
        const retryAfter = res.headers.get('retry-after');
        const waitMs     = retryAfter ? parseFloat(retryAfter) * 1000 : DEFAULT_BACKOFF_MS * attempt;
        lastError = new Error(`Anthropic ${res.status} (rate limit). Retrying after ${waitMs}ms. ${errBody}`);
        await sleep(waitMs);
        continue;
      }

      // 5xx — transient server error
      if (res.status >= 500) {
        const errBody = await res.text().catch(() => '');
        lastError = new Error(`Anthropic ${res.status}: ${errBody}`);
        await sleep(DEFAULT_BACKOFF_MS * attempt);
        continue;
      }

      // 4xx non-retriable
      const errBody = await res.text().catch(() => '');
      throw new Error(`Anthropic ${res.status}: ${errBody}`);

    } catch (err) {
      lastError = err;
      if (attempt >= maxTries) throw err;
      await sleep(DEFAULT_BACKOFF_MS * attempt);
    }
  }

  throw lastError || new Error('Failed to send to Anthropic after retries');
}

module.exports = { sendToAnthropic };
