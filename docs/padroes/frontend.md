# Frontend (renderer)

Domínio: renderer process (`src/renderer/`), HTML, CSS (Tailwind v4), i18n e a lógica de UI em `app.js`.

## Ao implementar

1. Leia o contrato e o Handshake da feature (issue ou PR).
2. Copie a linha de Preload do Handshake **verbatim** — não reinterprete.
3. Use exatamente os campos de `result.data` declarados no Handshake.

Sem Handshake no contrato, pare: o backend ainda não terminou.

## Como chamar IPC

```js
// Linha de preload copiada verbatim do Handshake no contrato
const result = await window.electronAPI.nomeAcao(payload);
if (result.ok) {
  const { campo } = result.data;  // apenas campos do Handshake
} else {
  console.error(result.error);
}
```

## Estrutura do renderer

- `src/renderer/index.html` — 4 páginas: `#pageHome`, `#pageTranscriptions`, `#pageReunions`, `#pageGeminiAI`
- `src/renderer/js/app.js` — toda lógica de UI e estado
- `src/renderer/js/i18n.js` — `window.t('chave')`
- `src/renderer/styles/main.css` — edite aqui, o arquivo gerado é ignorado pelo git

## Como adicionar i18n (sempre PT-BR + EN juntos)

```js
'pt-BR': { 'nova.chave': 'Texto em português' },
en:      { 'nova.chave': 'Text in English'     }
```

Nomes das chaves exatamente como no contrato.

## Nova página/seção

1. `<section id="pageNovo" class="hidden p-6">` em `index.html`
2. `<button data-page="pageNovo">` na sidebar
3. Navegação automática — sem código extra

## Estado de sessão Home

```js
_newHomeSession()      // antes de nova captura
_maybeShowHomeSave()   // após resposta IA
```

## Loading state

```js
setBtnLoading(btn, true, window.t('chave'));
setBtnLoading(btn, false);
```

Botão precisa de `.btn-spinner`, `.btn-icon`, `.btn-label`.

## Multi-provider

`applyActiveAiSource(source, save)` — badge + dropdown de modelos.
`extractAiText(res)` — extrai texto dos 3 formatos (Gemini/OpenAI/Anthropic).

## CSS

Edite `src/renderer/styles/main.css`. Compile com `npm run css` (build único) ou `npm run css:watch` (dev).
