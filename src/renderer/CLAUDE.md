# Contexto: renderer process

Este diretório roda no Chromium (renderer process). Sem acesso direto ao Node.js — tudo privilegiado vai via `window.electronAPI`.

## Regras obrigatórias

- **Nunca chamar `ipcRenderer` diretamente** — usar `window.electronAPI.xxx()` (exposto pelo preload)
- **Nunca assumir o formato de `result.data`** sem checar o Bloco de Handshake do backend
- **Nunca editar `styles/output.css`** — é gerado pelo Tailwind; editar `styles/main.css`
- Toda string visível ao usuário precisa de chave em `js/i18n.js` (PT-BR + EN juntos)
- IDs de elementos HTML: kebab-case (ex: `export-btn`, `meeting-modal`)

## Estrutura da UI

Quatro páginas inline no `index.html`: `#pageHome`, `#pageTranscriptions`, `#pageReunions`, `#pageGeminiAI`.

Navegação controlada por `data-page` na sidebar — sem código extra ao adicionar nova seção.

## Contrato de retorno IPC (sempre)

```js
const result = await window.electronAPI.qualquerAcao(payload);
if (result.ok) { /* result.data */ }
else           { /* result.error: string */ }
```

## Antes de usar qualquer canal IPC novo

Confirmar com o backend (Bloco de Handshake) o nome exato do método no preload e o shape de `result.data`.
