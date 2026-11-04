# OpenFatoAI

**English** · [Português (BR)](README.pt-BR.md)

> Formerly *Fato AI*. Free and open source under the [AGPL-3.0](LICENSE).

A discreet desktop assistant built with **Electron**. It captures microphone audio and on-screen text (OCR), sends it to the AI model of your choice (Gemini, OpenAI or Anthropic) and shows the answer in real time. It also transcribes speech **locally** with Whisper, and keeps your whole history in a local SQLite database.

Your API keys stay on your machine, encrypted with the operating system's keychain (Electron `safeStorage`).

## Features

- **Quick actions (Home):** record audio, capture the full screen or a selected region with OCR, send to the AI, save the session.
- **Transcriptions:** real-time, 100% local Whisper transcription, with short, detailed and agenda-based AI summaries.
- **Meetings:** paginated history with full-text search, editing and deletion.
- **Multi-provider AI:** Gemini, OpenAI and Anthropic (Claude) with your own API key; switch any time in Settings.
- **Privacy-minded:** the window is hidden from screen captures and recordings, global shortcut `Ctrl+Shift+F9` toggles it.
- **Light/dark theme** and **PT-BR / EN** interface.

## Download

Prebuilt packages for Linux (`.deb`), Windows and macOS will be published in [GitHub Releases](../../releases), each with a `.sha256` checksum.

> Builds are not code-signed yet, so Windows SmartScreen or macOS Gatekeeper may show a warning on first launch. Verify the checksum before installing.

## Run from source

```bash
git clone https://github.com/luicesar/OpenFatoAI.git
cd OpenFatoAI
npm install
npm run dev
```

Requirements: Node.js 18+, Tesseract OCR and, on Linux, `scrot`:

```bash
sudo apt install tesseract-ocr tesseract-ocr-por tesseract-ocr-eng scrot   # Linux
brew install tesseract tesseract-lang                                      # macOS
```

On Windows install Tesseract from the [UB Mannheim build](https://github.com/UB-Mannheim/tesseract/wiki) with the Portuguese and English language packs. You also need an API key from at least one provider (Gemini, OpenAI or Anthropic), set in the app's Settings.

More detail: [`docs/`](docs/README.md).

## Updates

On startup the app checks the public GitHub Releases API for a newer version and shows a banner linking to the release page — no project server involved. To turn it off, add `"checkForUpdates": false` to `config.json` in the app's data folder.

## Contributing

Issues and pull requests are welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md). Security reports go through [`SECURITY.md`](SECURITY.md). See the [roadmap](ROADMAP.md) and [changelog](CHANGELOG.md).

## Support the project

If OpenFatoAI is useful to you, you can [buy me a coffee](https://buymeacoffee.com/YOUR_USERNAME).

## License

[GNU AGPL v3.0](LICENSE). Third-party and trademark notices are in [`NOTICE.md`](NOTICE.md).
