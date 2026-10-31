'use strict';

// ── OpenAI Chat Completions — REST client ────────────────────────
// Uses fetch directly (no SDK dependency) for consistency with gemini.js.

const OPENAI_BASE_URL    = 'https://api.openai.com/v1';
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
 * Send an item to the OpenAI Chat Completions endpoint.
 * item: { kind: 'text'|'screenshot'|'audio', payload }
 * cfg:  { apiKey, model }
 * options: { prompt?, retries? }
 */
async function sendToOpenAI(item, cfg, options = {}) {
  if (!cfg?.apiKey) throw new Error('OpenAI API key not configured. Go to AI Sources → OpenAI and enter your key.');

  const fetchFn  = await getFetch();
  const model    = cfg.model || 'gpt-4o-mini';
  const endpoint = `${OPENAI_BASE_URL}/chat/completions`;
  const maxTries = options.retries ?? DEFAULT_RETRIES;

  // Build the user message content
  let userContent;

  if (item.kind === 'screenshot') {
    const dataUrl = item.payload?.dataUrl || '';
    if (!dataUrl.startsWith('data:image/')) throw new Error('Invalid dataUrl for screenshot');
    const systemPrompt = options.prompt || 'Describe this image and provide short suggested answers for exam questions.';
    userContent = [
      { type: 'image_url', image_url: { url: dataUrl, detail: 'auto' } },
      { type: 'text', text: systemPrompt },
    ];
  } else if (item.kind === 'audio') {
    // Step 1: transcribe via Whisper, then send transcript to Chat Completions
    const base64   = item.payload?.base64;
    const mimeType = item.payload?.mimeType || 'audio/webm';
    if (!base64) throw new Error('No audio data provided');

    const ext       = mimeType.split('/')[1]?.split(';')[0] || 'webm';
    const audioBlob = new Blob([Buffer.from(base64, 'base64')], { type: mimeType });
    const form      = new FormData();
    form.set('file', audioBlob, `audio.${ext}`);
    form.set('model', 'whisper-1');

    const whisperRes = await fetchFn(`${OPENAI_BASE_URL}/audio/transcriptions`, {
      method : 'POST',
      headers: { 'Authorization': `Bearer ${cfg.apiKey}` },
      body   : form,
    });

    if (!whisperRes.ok) {
      const errBody = await whisperRes.text().catch(() => '');
      throw new Error(`Whisper transcription failed (${whisperRes.status}): ${errBody}`);
    }

    const transcript = (await whisperRes.json()).text || '';
    const systemPrompt = options.prompt || 'Provide concise suggested answers and key points.';
    userContent = `${systemPrompt}\n\nAudio transcription:\n"${transcript}"`;
  } else {
    // text
    userContent = item.payload?.text || JSON.stringify(item.payload);
  }

  const body = {
    model,
    messages: [{ role: 'user', content: userContent }],
    max_tokens: cfg.maxTokens || 1024,
    temperature: cfg.temperature ?? 0.7,
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${cfg.apiKey}`,
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

      // 429 — rate limit
      if (res.status === 429) {
        const errBody    = await res.text().catch(() => '');
        const retryAfter = res.headers.get('retry-after');
        const waitMs     = retryAfter ? parseFloat(retryAfter) * 1000 : DEFAULT_BACKOFF_MS * attempt;
        lastError = new Error(`OpenAI 429 (rate limit). Retrying after ${waitMs}ms. ${errBody}`);
        await sleep(waitMs);
        continue;
      }

      // 5xx — transient server error
      if (res.status >= 500) {
        const errBody = await res.text().catch(() => '');
        const waitMs  = DEFAULT_BACKOFF_MS * attempt;
        lastError = new Error(`OpenAI ${res.status}: ${errBody}`);
        await sleep(waitMs);
        continue;
      }

      // 4xx non-retriable
      const errBody = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status}: ${errBody}`);

    } catch (err) {
      lastError = err;
      if (attempt >= maxTries) throw err;
      await sleep(DEFAULT_BACKOFF_MS * attempt);
    }
  }

  throw lastError || new Error('Failed to send to OpenAI after retries');
}

/**
 * Transcribe audio via OpenAI Whisper.
 * payload: { base64, mimeType }
 * Returns the transcript string.
 */
async function transcribeWithWhisper(payload, apiKey) {
  const fetchFn  = await getFetch();
  const base64   = payload?.base64;
  const mimeType = payload?.mimeType || 'audio/webm';
  if (!base64) throw new Error('No audio data provided');

  const ext       = mimeType.split('/')[1]?.split(';')[0] || 'webm';
  const audioBlob = new Blob([Buffer.from(base64, 'base64')], { type: mimeType });
  const form      = new FormData();
  form.set('file', audioBlob, `audio.${ext}`);
  form.set('model', 'whisper-1');

  const res = await fetchFn(`${OPENAI_BASE_URL}/audio/transcriptions`, {
    method : 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body   : form,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Whisper transcription failed (${res.status}): ${errBody}`);
  }

  return (await res.json()).text || '';
}

module.exports = { sendToOpenAI, transcribeWithWhisper };
