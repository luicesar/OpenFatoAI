# OpenFatoAI

[English](README.md) · **Português (BR)**

> Antigo *Fato AI*. Código aberto sob [AGPL-3.0](LICENSE).

Assistente de desktop discreto construído com **Electron** que captura áudio do microfone e texto da tela via OCR, enviando o conteúdo para modelos de IA (Gemini, OpenAI ou Claude/Anthropic) e retornando respostas em tempo real. Conta também com transcrição automática de fala localmente via **Whisper** (`@xenova/transformers`), rodando 100% no processo principal — sem servidores externos.

O app salva todo o histórico de sessões em um banco de dados SQLite local (`sql.js`/WASM) e exibe os registros na aba **Reuniões**.

---

## Funcionalidades

### Home
- **Gravação de áudio** com detecção de silêncio por RMS — envia para IA ao parar
- **Captura de tela inteira** + OCR (Tesseract)
- **Seleção de área** — overlay interativo para capturar apenas a região desejada
- **Botão Limpar** — apaga o log e oculta o painel de resposta IA
- **Botão Salvar** — persiste a sessão (log + resposta IA) na aba Reuniões
- Timer de gravação exibido dentro do botão `Iniciar Gravação`
- Resposta IA é limpa automaticamente ao iniciar nova gravação

### Transcrições
- **Transcrição em tempo real** via Whisper (`xenova/whisper-base`, ~142 MB) — 100% local
- Guard de navegação: impede trocar de tela durante transcrição ativa
- Timer de gravação no botão + tempo total exibido após parar
- **Resumo Curto IA** — 3 a 5 frases com os pontos principais
- **Resumo Detalhado IA** — análise completa com tema, decisões e itens de ação
- **Resumo de IA baseado na Agenda** — resumo estruturado por tópicos da agenda da reunião

### Reuniões
- Tabela paginada com **busca full-text** em resumo, transcrição e provedor
- Coluna **Tipo**: badge amber = Ações Rápidas (Home), badge índigo = Transcrições
- **Modal de edição** (layout duas colunas) para alterar qualquer sessão salva
- Ações: editar e excluir por linha

### Provedores de IA (multi-provider)
| Provedor | Modelos disponíveis |
|---|---|
| **Gemini** (padrão) | gemini-2.5-flash-lite, gemini-2.5-flash, gemini-2.5-pro |
| **OpenAI** | gpt-4o-mini, gpt-4o, gpt-4.1-mini, gpt-4.1 |
| **Anthropic / Claude** | claude-haiku-4, claude-sonnet-4, claude-opus-4 |

A troca de provedor é feita nas Settings — o provedor ativo aparece em um badge na Home.

### Outros
- **Tema claro/escuro** com persistência dupla (localStorage + `config.json`)
- **Atalho global** `Ctrl+Shift+F9` para mostrar/ocultar a janela
- `setContentProtection(true)` — janela não aparece em capturas/gravações de tela
- **Internacionalização** PT-BR e EN (`src/renderer/js/i18n.js`)

---

## Pré-requisitos

- **Node.js** v18 ou superior
- **Tesseract OCR** instalado no sistema:
  ```bash
  sudo apt install tesseract-ocr tesseract-ocr-por tesseract-ocr-eng
  ```
- Ferramenta de screenshot (Linux):
  ```bash
  sudo apt install scrot
  ```
- Uma **chave de API** de pelo menos um provedor:
  - Gemini: [Google AI Studio](https://aistudio.google.com/app/apikey)
  - OpenAI: [platform.openai.com](https://platform.openai.com/api-keys)
  - Anthropic: [console.anthropic.com](https://console.anthropic.com/)

---

## Instalação

```bash
npm install
```

Crie um arquivo `.env` na raiz do projeto (opcional — as chaves também podem ser configuradas pela UI):

```
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models
DEFAULT_PROMPT="Responda em português. Seja direto e breve."
```

---

## Uso

```bash
# Desenvolvimento (watch CSS + Electron)
npm run dev

# Produção / uso normal
npm start
```

Use `Ctrl+Shift+F9` para mostrar/ocultar a qualquer momento.

---

## Estrutura do Projeto

```
src/
├── main/
│   ├── index.js          # Entry point do processo principal
│   ├── window.js         # Criação e gerenciamento da BrowserWindow
│   ├── menu.js           # Tray icon e menu de sistema
│   ├── preload.js        # contextBridge (main window)
│   └── ipc/
│       ├── ai.js         # IPC: send-audio, send-screenshot, send-text → provedores IA
│       ├── config.js     # IPC: save/load config (shallow merge)
│       ├── hardware.js   # IPC: info de hardware
│       ├── screen.js     # IPC: captura de tela + OCR
│       ├── auth.js       # IPC: autenticação (stub)
│       ├── payments.js   # IPC: pagamentos (stub)
│       ├── transcriptions.js  # IPC: CRUD SQLite de reuniões
│       └── whisper.js    # IPC: transcrição Whisper (main process)
├── renderer/
│   ├── index.html        # UI principal (Home, Transcrições, Reuniões, Settings)
│   ├── selector.html     # Overlay de seleção de região
│   └── js/
│       ├── app.js        # Toda a lógica do renderer
│       ├── i18n.js       # Internacionalização (pt-BR / en)
│       └── selector.js   # Lógica do overlay de seleção
├── services/
│   ├── gemini.js         # Cliente HTTP Gemini com retry/backoff
│   ├── logger.js         # Logger estruturado
│   ├── ocr.js            # Wrapper Tesseract
│   └── database.js       # SQLite via sql.js (WASM) — sem addon nativo
└── shared/
    ├── constants.js      # Constantes compartilhadas
    └── utils.js          # Utilitários comuns
```

---

## Banco de Dados

- Engine: **sql.js** (SQLite via WebAssembly) — sem addon nativo, sem problemas de compatibilidade GLIBC
- Arquivo: `~/.config/openfatoai/fato-ai.db`
- Tabela principal: `meetings` com campos `session_hash` (UNIQUE), `meeting_type` (1=Home, 2=Transcrições), `transcript_text`, `ai_summary`, `ai_provider`, `ai_model`, `recorded_seconds`, etc.

---

## Atalhos

| Atalho | Ação |
|---|---|
| `Ctrl+Shift+F9` | Mostrar / Ocultar a janela |

> No Linux, `Ctrl+Shift+Space` é capturado pelo IBus (método de entrada), por isso foi substituído por `Ctrl+Shift+F9`.

---

## Segurança

- `contextIsolation: true` e `nodeIntegration: false` em todas as janelas
- Chaves de API armazenadas via `safeStorage` (criptografia nativa do SO)
- `setContentProtection(true)` impede a janela de aparecer em gravações/streams
- `.env` e `src/models/` estão no `.gitignore`

---

## Performance

- Whisper roda no **processo principal** (Node.js) via `@xenova/transformers` — evita limitações de ES Modules em Workers com `file://`
- `Float32Array` passado diretamente via IPC (structured-clone binário) — evita o diálogo "not responding" que ocorria com `Array.from()` serializado como JSON
- Chunks de 10 segundos com detecção de silêncio por RMS (`< 0.008`)
- `condition_on_previous_text: false`, `no_speech_threshold: 0.6`, `logprob_threshold: -1.0`
- Filtro pós-processamento remove tokens especiais e loops de bigramas
- Modelo `xenova/whisper-base` (~142 MB) baixado automaticamente no primeiro uso

---

## Sincronização opcional (self-hosted)

Tudo funciona localmente, sem conta e sem servidor. Se quiser as reuniões salvas espelhadas em um PostgreSQL seu, suba o backend de [`docker/`](docker/README.md) (`docker compose up -d --build`) e informe a URL em **Configurações → Sincronização**. Cada instalação é identificada só por um ID aleatório e anônimo — não há contas. Detalhes: [`backend/README.md`](backend/README.md).

## Atualizações

Ao abrir, o app consulta a API pública de Releases do GitHub e mostra um aviso com o link da release quando há versão nova — sem servidor do projeto. Para desligar, adicione `"checkForUpdates": false` ao `config.json` na pasta de dados do app.

## Contribuindo

Veja [`CONTRIBUTING.md`](CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md) e a documentação em [`docs/`](docs/README.md).

---

## Apoie o projeto

Se o OpenFatoAI é útil para você, considere [me pagar um café](https://buymeacoffee.com/YOUR_USERNAME). 

---

## Licença

[GNU AGPL v3.0](LICENSE). Avisos de terceiros e de marca em [`NOTICE.md`](NOTICE.md).

