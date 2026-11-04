# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentação

Índice em [`docs/README.md`](docs/README.md): `docs/usuario/` (guia do usuário) e `docs/padroes/` (fluxo de feature e convenções de backend, frontend, QA e DevOps).

## Commands

```bash
# Development (CSS watch + Electron concurrently)
npm run dev

# Production run (builds CSS once, then starts Electron)
npm start

# CSS only
npm run css          # one-time build
npm run css:watch    # watch mode

# Download Vosk speech model (~52 MB, optional — only needed for Vosk)
npm run download-model

# Build & Distribution
npm run build:css    # build CSS once (required before dist)
npm run dist:dir     # quick build: unpacked Linux executable in dist/linux-unpacked/
npm run dist         # full build: AppImage + .deb packages in dist/
```

There are no automated tests. `src/tests/api-test-openrouter.js` is a manual integration script, not part of any test runner.

**System prerequisites** (Linux):
```bash
sudo apt install tesseract-ocr tesseract-ocr-por tesseract-ocr-eng scrot
```

**System prerequisites** (Windows):

Instale o Tesseract-OCR via instalador do [UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki), marcando os pacotes de idioma **português** e **inglês** durante a instalação. O app detecta automaticamente instalações em `C:\Program Files\Tesseract-OCR\`, `C:\Program Files (x86)\Tesseract-OCR\` e `%LOCALAPPDATA%\Programs\Tesseract-OCR\` (via `_resolveTesseractBin()` em `src/main/ipc/screen.js`), mesmo sem o binário estar no `PATH`. Se instalado em outro diretório, adicione-o ao `PATH` manualmente.

**System prerequisites** (macOS):
```bash
brew install tesseract tesseract-lang
```
O pacote `tesseract-lang` inclui os dados de idioma adicionais, incluindo português (`por`).

## Architecture

Electron app with a strict main/renderer process separation (`contextIsolation: true`, `nodeIntegration: false`).

### Process split

**Main process** (`src/main/`) handles all privileged operations:
- Window/tray lifecycle (`window.js`, `menu.js`)
- All IPC handlers registered in `index.js` via modules in `ipc/`
- Whisper ASR runs in a **child process** (`ELECTRON_RUN_AS_NODE`, see `ipc/whisper.js`) — models > ~150 MB crash a worker inside Electron's regular mode (SIGTRAP), and `@huggingface/transformers` can't be dynamically imported in Workers under `file://` in Electron
- OCR via spawned `tesseract` child process (`services/ocr.js`)
- SQLite via `sql.js` (WASM) — never runs in renderer (`services/database.js`)
- API keys encrypted via Electron `safeStorage` (stored as `.enc` files in `userData`)

**Renderer process** (`src/renderer/`) is one large file:
- `js/app.js` — all UI logic for Home, Transcrições, Reuniões, and Settings tabs
- `js/i18n.js` — PT-BR / EN translations; access via `window.t('key')`
- `js/selector.js` — region-selection overlay logic
- CSS compiled by Tailwind v4 (`styles/main.css` → `styles/output.css`, gitignored)

**Services** (`src/services/`) are main-process only:
- `gemini.js`, `openai.js`, `anthropic.js` — REST clients with retry/backoff; all use `fetch` directly (no SDK)
- `database.js` — sql.js WASM SQLite; persists to `~/.config/openfatoai/fato-ai.db`; calls `db.export()` + `fs.writeFileSync` after every write
- `logger.js` — structured logging via `electron-log`
- `ocr.js` — Tesseract wrapper with fallback lang attempts (defined in `shared/constants.js` as `TESSERACT_ATTEMPTS`)

**Shared** (`src/shared/`) is safe to require from both processes:
- `constants.js` — single source of truth for IPC channel names (`IPC.*`), API base URLs, key patterns, `GLOBAL_SHORTCUT`
- `utils.js` — common utilities

### IPC contract

The `contextBridge` in `src/main/preload.js` exposes `window.electronAPI` with functions wrapping every IPC channel. All channel names are constants in `src/shared/constants.js` under the `IPC` object.

Critical performance detail: `whisperTranscribe` passes `Float32Array` directly via IPC (structured-clone binary). Never convert to `Array.from()` — serializing millions of floats as JSON blocks the event loop on long recordings.

### Multi-provider AI

Three providers: `'gemini'`, `'openai'`, `'anthropic'`. Active provider stored in `config.json` as `activeAiSource`.

**Anthropic limitation**: the Messages API doesn't accept audio. When Anthropic is active and the user records audio on the Home tab, the renderer uses Web Speech API to transcribe locally during recording, then sends the resulting text via `send-text` instead of `send-audio`.

`extractAiText(res)` in `app.js` handles the three different response shapes (Gemini candidates, OpenAI choices, Anthropic content array).

### Config persistence

`save-config` IPC does a **shallow merge** (`{ ...existing, ...incoming }`), so callers only need to send changed fields. Fields: `sourceAIPrompt`, `sourceAIModel`, `activeAiSource`, `openaiModel`, `anthropicModel`, `theme`, `language`.

Theme is persisted in **two places**: `localStorage` (read in `<head>` inline script to prevent flash) and `userData/config.json` (durable cross-session).

### Database schema

Table `meetings` — key fields:
- `session_hash` TEXT UNIQUE — UUID generated in renderer per session
- `meeting_type` INTEGER — `1` = Home (Quick Actions), `2` = Transcrições
- `ai_provider`, `ai_model` — which provider/model produced the summary
- `saveTranscription()` uses `INSERT OR REPLACE` (upsert by `session_hash`)

### Internationalisation

All user-facing strings go through `window.t('key')` (renderer) using `src/renderer/js/i18n.js`. Both PT-BR and EN keys must be added together. The active language is stored in `config.json` as `language` and applied via `applyLanguage()` in `app.js`.

## Building & Distribution

Configured via `electron-builder.yml` (root level). No configuration in `package.json`.

### Output artifacts

- **`npm run dist:dir`** — unpacked executable for quick testing: `dist/linux-unpacked/openfatoai` (no packaging, ~250 MB)
- **`npm run dist`** — full distribution packages:
  - `dist/OpenFatoAI-0.1.0.AppImage` — portable single-file Linux executable (~416 MB, includes all deps)
  - `dist/openfatoai_0.1.0_amd64.deb` — Debian package (~374 MB, with dependencies listed)

### ASAR bundling

Enabled (`asar: true`) with strategic unpacking:
- `@huggingface/transformers` — large ML models need loose access for imports
- `sql.js` — WASM module needs direct filesystem access
- `electron-log` — requires direct access to config dirs

This balances startup performance (ASAR compression) with compatibility for WASM/ESM modules.

### .deb dependencies

Automatically declared in `.deb` package: `tesseract-ocr`, `tesseract-ocr-por`, `tesseract-ocr-eng`.

### Adding an app icon

Place a **512×512 PNG** at `resources/icon.png` before running `npm run dist`. The build will auto-scale to 16×32×48×64×128×256 and embed in both AppImage and .deb.

### Disabling targets

Edit `electron-builder.yml` → `linux:target` to build only AppImage or only .deb if needed.

## Backend (opcional) — PostgreSQL

O backend C# em `backend/` usa **Dapper + PostgreSQL (12+; o Docker usa 16)** e não tem login, planos nem pagamentos (ver `backend/README.md`). Regras obrigatórias:

- Todo SELECT, INSERT, UPDATE e DELETE é uma **stored function** em `backend/OpenFatoAI.Infrastructure/SQL/`
- Repositories C# chamam apenas funções via Dapper — **nenhum SQL de tabela inline** nos arquivos `.cs`
- Novas funções entram em migrações numeradas sequencialmente (`002_...sql`)
- Nomes de funções seguem `fn_<verbo>_<entidade>` (ex: `fn_list_meetings`, `fn_upsert_meeting`)
- Dados por instalação são sempre filtrados por `installation_id`

