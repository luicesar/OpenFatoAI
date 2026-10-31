# Changelog

All notable changes are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/), versioning follows [SemVer](https://semver.org/).

## [Unreleased]

### Added
- The app now runs fully local: no account, login, plans or payments. It opens straight into the app and uses your own API keys.
- Optional backend (.NET 8 + PostgreSQL) with no accounts: stores meetings per anonymous installation (`/api/meetings`).
- Optional meeting sync: set a server URL in Settings → Sync to mirror saved meetings to your own OpenFatoAI backend (anonymous installation ID, no account).
- Docker stack (PostgreSQL 16 + API, optional Caddy HTTPS profile) to self-host the optional backend.

### Removed
- Login, registration, plans/Stripe checkout, support tickets, summary e-mail, LGPD consent, the Translation page and the Kokoro/LibreTranslate integration (they depended on a hosted backend).
- Daily usage limits; the dependencies `axios`, `nodemailer`, `node-machine-id` and `@openrouter/sdk`.

### Changed
- Update check now uses GitHub Releases instead of a project server (opt out with `checkForUpdates: false`).
- Project prepared for open source under AGPL-3.0 and renamed from Fato AI to OpenFatoAI.
- User data now lives in `~/.config/openfatoai` (Linux) / the equivalent app-data folder. On first run, data from the old `fato-ia` folder is copied automatically. Saved API keys may need to be re-entered, because the OS keychain entry is tied to the app name.

## [0.1.0]

Initial private releases (Linux, Windows, macOS): audio/screen capture with OCR, local Whisper transcription, multi-provider AI (Gemini, OpenAI, Anthropic), local meeting history.
