# Notices

OpenFatoAI is licensed under the **GNU Affero General Public License v3.0** (see [`LICENSE`](LICENSE)).

## Trademark

The name **OpenFatoAI**, the former name **Fato AI**, and the project logo and icon are not covered by the AGPL license. You may fork and redistribute the code under the license terms, but a modified version must not be presented as the official OpenFatoAI app or use its name and logo in a way that suggests endorsement.

## Third-party software

OpenFatoAI uses open-source packages under their own licenses. Production npm dependencies are permissive (MIT, Apache-2.0, BSD, ISC and similar); run `npm ls --omit=dev` and inspect `package-lock.json` for the exact list. Notable ones:

| Component | License |
|---|---|
| Electron (includes Chromium) | MIT (Chromium notices are bundled by electron-builder) |
| `@xenova/transformers` | Apache-2.0 |
| `onnxruntime-node`, `onnxruntime-web` | MIT |
| `vosk-browser` | Apache-2.0 |
| `sql.js` | MIT |
| `sharp` | Apache-2.0 |
| `dotenv`, `electron-log`, `screenshot-desktop` | MIT |

## Models and external tools (not part of this repository)

These are downloaded at runtime or installed separately, and keep their own licenses. Check each project for the current terms before redistributing.

| Component | Typical license |
|---|---|
| Whisper models (`Xenova/whisper-base`) | MIT |
| Vosk speech models | Apache-2.0 |
| Tesseract OCR and language data | Apache-2.0 |
| Optional Python services: `faster-whisper`, `resemblyzer`, `scikit-learn` | MIT / Apache-2.0 / BSD |

## AI providers

The app talks to Gemini, OpenAI and Anthropic using **your own API keys**. Your use of those services is governed by their terms; no keys are bundled.
