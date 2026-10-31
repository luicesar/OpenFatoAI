# Backend (main process)

Domínio: processo principal do Electron (`src/main/`), serviços (`src/services/`) e tudo que roda em Node.js.

## Ao implementar

1. Leia o contrato da feature (descrito na issue ou PR).
2. Implemente exatamente o que o contrato diz — nome de canal, payload, retorno.
3. Escreva o Handshake no contrato para o frontend consumir.

Sem contrato registrado, não implemente: especifique primeiro (veja [`especificacao.md`](especificacao.md)).

## Padrão de IPC handler

```js
'use strict';
const { ipcMain } = require('electron');
const { createLogger } = require('../../services/logger');
const { ok, fail } = require('../../shared/utils');
const log = createLogger('ipc:nome');

function registerNomeHandlers() {
  ipcMain.handle('canal-nome', async (_event, payload) => {
    try {
      return ok({ data });
    } catch (e) {
      log.error('canal-nome failed', { error: e.message });
      return fail(e);
    }
  });
}

module.exports = { registerNomeHandlers };
```

Checklist obrigatório:
- [ ] `src/main/index.js`: require + chamada em `app.whenReady()`
- [ ] `src/main/preload.js`: exposição via `contextBridge`
- [ ] Handshake escrito no contrato (issue ou PR)

## Formato do Handshake

## Padrão de serviço AI

```js
async function sendToXxx(item, cfg, options = {})
// item: { kind: 'text'|'screenshot'|'audio', payload }
// retorna: { status, body, json }
```

Anthropic não aceita áudio — transcrever via Whisper (OpenAI) ou Gemini antes de `send-text`.

## Banco de dados

Engine: sql.js (WASM). Arquivo: `~/.config/openfatoai/fato-ai.db`.
- `session_hash` TEXT UNIQUE — UUID do renderer
- `meeting_type`: `1` = Home, `2` = Transcrições
- Novas colunas: adicionar em `CREATE_TABLE` + `saveTranscription()`, nome snake_case conforme contrato

## Resolução de config/chaves

Prioridade: `safeStorage (.enc)` → `cfg.xxxApiKey` → `process.env.XXX_API_KEY`
Funções em `src/main/ipc/config.js`: `resolveGeminiConfig()`, `resolveOpenAIConfig()`, `resolveAnthropicConfig()`
