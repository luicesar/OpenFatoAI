# DevOps e ambiente

Domínio: ambiente de desenvolvimento, dependências do sistema, build e distribuição.

## Ao receber um problema

1. Identifique se é ambiente, build ou configuração.
2. Diagnostique com os comandos abaixo.
3. Corrija e confirme com quem reportou.

## Diagnóstico rápido

```bash
node --version          # deve ser >= 18
which tesseract         # deve existir
tesseract --version     # deve ter por+eng
which scrot             # deve existir no Linux
ls ~/.config/openfatoai/   # estado em runtime
```

## Setup do projeto

```bash
# Dependências do sistema (Linux)
sudo apt install tesseract-ocr tesseract-ocr-por tesseract-ocr-eng scrot

# Dependências Node
npm install

# .env (opcional — chaves também configuráveis pela UI)
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models
DEFAULT_PROMPT="Responda em português. Seja direto e breve."
```

## Dados em runtime

```
~/.config/openfatoai/
├── fato-ai.db         # SQLite (sql.js WASM)
├── config.json        # settings
├── api-key.enc        # Gemini (safeStorage)
├── openai-key.enc     # OpenAI (safeStorage)
└── anthropic-key.enc  # Anthropic (safeStorage)

~/.cache/huggingface/hub/   # Whisper (~142 MB, download automático)
~/.config/openfatoai/logs/main.log  # logs do electron-log
```

## Arquivos gerados (não comitar, não editar)

- `src/renderer/styles/output.css` — gerado pelo Tailwind
- `src/models/` — modelos ML
- `node_modules/`, `.env`

## Empacotamento (quando solicitado)

Configurado via `electron-builder.yml` (raiz). Comandos em CLAUDE.md:
- `npm run dist:dir` — executável desempacotado em `dist/linux-unpacked/`
- `npm run dist` — AppImage + .deb em `dist/`

Atenção: `sql.js` usa WASM e `@xenova/transformers` é ESM — ambos desempacotados via `asarUnpack` no `electron-builder.yml`.

## Pipeline de release completo (Linux + Windows + macOS → VPS)

**⚠️ Só execute `npm run release` / `scripts/release.sh` quando o usuário pedir explicitamente um "release completo" (ou equivalente). Nunca dispare por conta própria, mesmo que a tarefa pareça relacionada a build/empacotamento.**

`scripts/release.sh` automatiza, em 8 passos:
1. Build Linux local (`dist:x64` + `dist:arm64`) → `dist/openfatoai_<versão>_amd64.deb` e `_arm64.deb`
2. Dispara `build-windows.yml` e `build-macos.yml` via GitHub Actions (`gh workflow run`)
3. Espera os dois runs terminarem (`gh run watch`)
4. Baixa os artefatos (`gh run download`) para `dist/windows/` e `dist/macOS/`
5. Renomeia para o padrão `openfatoai_<versão>_win.exe`, `openfatoai_<versão>.dmg`, `openfatoai_<versão>-arm64.dmg`
6. Limpa apenas artefatos antigos conhecidos (zips, .exe/.dmg de versões anteriores) — preserva diretórios auxiliares (`linux-unpacked/`, `builder-debug.yml`, etc.)
7. Envia os 5 arquivos finais via `scp` para o servidor de downloads (`RELEASE_VPS`, `RELEASE_VPS_KEY` e `RELEASE_VPS_DIR`, definidos em `scripts/release.env` — veja `scripts/release.env.example`)
8. Verifica o conteúdo remoto via `ssh`

Pré-requisito: `gh` CLI instalado em `~/.local/bin/gh` (já feito) e autenticado via `gh auth login` (o usuário roda isso interativamente — não é automatizável).
