# Contributing to OpenFatoAI

Thanks for helping! Contributions in English or Portuguese (PT-BR) are welcome.

## Licensing of contributions

By submitting a contribution you agree that it is licensed under the project's license, **AGPL-3.0** (see [`LICENSE`](LICENSE)). There is no CLA.

## Getting started

```bash
git clone https://github.com/luicesar/OpenFatoAI.git
cd OpenFatoAI
npm install
npm run dev        # Tailwind watch + Electron
```

Linux needs `tesseract-ocr tesseract-ocr-por tesseract-ocr-eng scrot` (and an X11 session for global shortcuts/OCR).

## Before you open a PR

- Open an issue first for anything larger than a small fix, so we can agree on the approach.
- Follow the rules in [`CLAUDE.md`](CLAUDE.md) and [`docs/padroes/`](docs/padroes/README.md). The important ones:
  - no privileged logic in the renderer — it belongs in `src/main/ipc/`;
  - new IPC channels are declared in `src/shared/constants.js` and registered in `src/main/index.js`;
  - API keys only through `safeStorage`;
  - every UI string needs a key in `src/renderer/js/i18n.js` in **both** PT-BR and EN;
  - never edit `src/renderer/styles/output.css` (generated — edit `main.css`).
- There is no automated test suite yet. Describe how you tested your change.
- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).

## Reporting bugs and ideas

Use the issue templates. For security problems, see [`SECURITY.md`](SECURITY.md).

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
