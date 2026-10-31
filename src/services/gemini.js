const DEFAULT_RETRIES = 1;       // só para erros 5xx
const DEFAULT_BACKOFF_MS = 1000;
const MAX_RETRY_WAIT_MS = 30_000; // acima disso = cota diária, não adianta retentar

async function getFetch() {
  if (globalThis.fetch) return globalThis.fetch.bind(globalThis);
  try {
    const nodeFetch = require('node-fetch');
    return nodeFetch;
  } catch (e) {
    throw new Error('fetch is not available. Use Node 18+ or install node-fetch');
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Send item to configured Gemini endpoint with retries/backoff.
 * item: { kind, payload }
 * cfg: { endpoint, apiKey }
 */
async function sendToGemini(item, cfg, options = {}) {
  if (!cfg || !cfg.endpoint) throw new Error('Gemini endpoint missing');
  const endpoint = cfg.endpoint;
  const apiKey = (cfg.apiKey || process.env.GEMINI_API_KEY);
  if (!apiKey) throw new Error('Gemini API key missing: set GEMINI_API_KEY or configure in app settings');

  const fetchFn = await getFetch();

  const maxTries = options.retries ?? DEFAULT_RETRIES;
  let attempt = 0;
  let lastError = null;
  while (attempt < maxTries) {
    attempt++;
    try {
      // Build request body according to Gemini REST API (generateContent)
      // Accept either a full endpoint URL or a model identifier in cfg.model
      const modelEndpoint = endpoint; // caller should provide full generateContent endpoint

      // Construct parts depending on item.kind
      const parts = [];
      if (item.kind === 'screenshot') {
        // payload: { dataUrl }
        const dataUrl = item.payload.dataUrl || '';
        const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
        if (match) {
          const mime = match[1];
          const b64 = match[2];
          parts.push({ inline_data: { mime_type: mime, data: b64 } });
          parts.push({ text: (options.prompt || 'Describe this image and provide short suggested answers for exam questions.') });
        } else {
          throw new Error('Invalid dataUrl for screenshot');
        }
      } else if (item.kind === 'audio') {
        // payload: { mimeType, base64 }
        const mime = item.payload.mimeType || 'audio/webm';
        const b64 = item.payload.base64;
        if (!b64) throw new Error('No base64 audio payload');
        parts.push({ inline_data: { mime_type: mime, data: b64 } });
        parts.push({ text: (options.prompt || 'Transcribe this audio and provide concise suggested answers and key points.') });
      } else {
        // generic: send text
        parts.push({ text: item.payload?.text || JSON.stringify(item.payload) });
      }

      const body = {
        contents: [ { role: 'user', parts } ]
      };

      const headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      };

      console.log('Gemini request endpoint:', modelEndpoint);
      console.log('Gemini request body:', JSON.stringify(body).slice(0, 2000));
      const res = await fetchFn(modelEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (res.ok) {
        let text = '';
        try { text = await res.text(); } catch (_) { text = '<no-body>'; }
        console.log('Gemini send OK', res.status);
        // Try parse JSON for structured response
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
        console.log('Gemini raw response (truncated):', String(text).slice(0, 4000));
        return { status: res.status, body: text, json: parsed };
      }

      // handle rate limiting (429)
      if (res.status === 429) {
        const errBody = await res.text().catch(() => '');
        // Try to parse retryDelay from Gemini JSON body
        let retryDelayMs = DEFAULT_BACKOFF_MS;
        try {
          const parsed = JSON.parse(errBody);
          const retryDelaySec = parsed?.error?.details
            ?.find(d => d['@type']?.endsWith('RetryInfo'))
            ?.retryDelay?.replace('s', '');
          if (retryDelaySec) retryDelayMs = parseFloat(retryDelaySec) * 1000;
        } catch (_) {}

        // Se o delay é grande (cota diária), não adianta retentar
        if (retryDelayMs > MAX_RETRY_WAIT_MS) {
          const mins = Math.ceil(retryDelayMs / 60000);
          throw new Error(`Cota diária da Gemini API esgotada. Tente novamente em ~${mins} minutos (ou amanhã). Detalhe: ${errBody}`);
        }

        lastError = new Error(`Gemini responded 429 (rate limit per minute): aguardando ${retryDelayMs}ms`);
        console.warn(`Gemini 429, retrying after ${retryDelayMs}ms (attempt ${attempt})`);
        await sleep(retryDelayMs);
        continue;
      }

      // for other 5xx errors, backoff and retry
      if (res.status >= 500 && res.status < 600) {
        const wait = DEFAULT_BACKOFF_MS * attempt;
        const errBody = await res.text().catch(() => '');
        lastError = new Error(`Gemini responded ${res.status}: ${errBody}`);
        console.warn(`Gemini server error ${res.status}, retrying after ${wait}ms (attempt ${attempt})`);
        await sleep(wait);
        continue;
      }

      // non-retriable error — throw immediately (no retry)
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini responded ${res.status}: ${text}`);
    } catch (err) {
      lastError = err;
      if (attempt >= maxTries) throw err;
      const wait = DEFAULT_BACKOFF_MS * attempt;
      console.warn(`Send attempt ${attempt} failed, retrying in ${wait}ms`, err.message);
      await sleep(wait);
    }
  }
  throw lastError || new Error('Failed to send to Gemini after retries');
}

module.exports = { sendToGemini };
