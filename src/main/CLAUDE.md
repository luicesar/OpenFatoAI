# Contexto: processo principal

Este diretório roda em Node.js (main process). Nunca use APIs do browser aqui.

## Regras obrigatórias

- Todo handler IPC deve usar `ok()`/`fail()` de `../../shared/utils` — nunca retornar objetos brutos
- Após criar arquivo em `ipc/`, registrar em `index.js` (`registerXxxHandlers()` dentro de `app.whenReady()`)
- Após implementar IPC novo, emitir o Bloco de Handshake para o frontend (formato em `docs/padroes/especificacao.md`)
- API keys: sempre ler via `safeStorage` — os arquivos `.enc` têm prioridade sobre `.env`
- `Float32Array` de áudio: nunca converter para `Array.from()` antes de enviar via IPC

## Ponto de entrada

`index.js` — registra todos os handlers, inicializa DB e atalho global.

## Onde cada coisa vive

| Necessidade | Arquivo |
|-------------|---------|
| Novo canal IPC | `ipc/[dominio].js` + registrar em `index.js` |
| Novo cliente AI | `../services/[provider].js` — seguir o contrato de `sendToXxx(item, cfg, options)` |
| Nova coluna no DB | `../services/database.js` → `CREATE_TABLE` + `saveTranscription()` |
| Nova constante compartilhada | `../shared/constants.js` |
| Resolução de config/chave | `ipc/config.js` → `resolveXxxConfig()` |
