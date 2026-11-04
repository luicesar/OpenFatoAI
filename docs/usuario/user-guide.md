# OpenFatoAI — User Guide

[Português (BR)](guia-usuario.md) · **English**

## What is OpenFatoAI?

OpenFatoAI is a discreet desktop assistant that lives in your system tray. It captures what is on your screen or microphone, sends it to an AI and returns quick answers — without leaving your current window. It also does **automatic real-time speech transcription**, 100% local, without sending audio to any external server.

The app supports four AI providers: **Gemini** (Google), **OpenAI** (GPT), **Anthropic** (Claude) and **OpenCode Go** (Kimi, DeepSeek, GLM…).

**Main use cases:**
- Capture the text of a question on screen and get the AI's answer
- Automatically transcribe the audio of a meeting, video or conversation in real time
- Select a specific screen area to extract and process only the relevant text
- Record audio and get an AI analysis
- Browse your saved sessions in the Meetings tab

---

## Requirements

Before using the app for the first time:

1. **Node.js** installed (v18 or newer) — only needed to run from source
2. An **API key** from at least one provider:
   - Gemini: [Google AI Studio](https://aistudio.google.com/app/apikey) (free)
   - OpenAI: [platform.openai.com](https://platform.openai.com/api-keys)
   - Anthropic: [console.anthropic.com](https://console.anthropic.com/)
   - OpenCode Go: [opencode.ai](https://opencode.ai/) (Go plan)
3. Tools for screen capture and OCR:
   - **Linux**:
     ```bash
     sudo apt install scrot tesseract-ocr tesseract-ocr-por tesseract-ocr-eng
     ```
     > The app's `.deb` package installs these dependencies automatically.
   - **Windows**: OCR needs Tesseract-OCR installed separately. Download the installer from [github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki) and select the Portuguese and English language packs during installation. The app detects the default install path automatically.
   - **macOS**: install Tesseract with Homebrew:
     ```bash
     brew install tesseract tesseract-lang
     ```

---

## Installation and setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the `.env` file (optional)

API keys can be set in the app (Settings). The `.env` is optional and only pre-configures the default provider:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.6-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models
DEFAULT_PROMPT="Answer in English. Be direct and brief."
```

### 3. Start the app

```bash
# Normal use
npm start

# Development (with CSS watch)
npm run dev
```

An icon appears in the **system tray**. Click it to open the window, or use the shortcut `Ctrl+Shift+F9`.

---

## App interface

The window has a **navigation sidebar** on the left and the **main area** on the right with the sections: Home, Transcriptions, Meetings, AI Sources, Settings and Help.

### Sidebar (left)

- **Brand** — "OpenFatoAI" at the top
- **Navigation** — a button for each section
- **Buy me a coffee** — link to support the project (opens in your default browser)
- **Theme** — switches between light and dark mode; saved automatically
- **Hide now** — red button that hides the window immediately
- **Shortcut** — shows `Ctrl+Shift+F9`

---

## Home

Home is the main area for quick screen or audio capture with AI analysis.

### Capture buttons

| Button | Action |
|---|---|
| **● Start Recording** | Starts recording from the microphone; shows a timer on the button |
| **■ Stop Recording** | Stops and sends the audio to the AI automatically |
| **📷 Capture Full Screen** | Takes a screenshot + OCR of the whole screen |
| **⬚ Select Screen Area** | Opens an overlay to select a screen region + OCR |

### Capture flow

1. Use one of the buttons above to capture text or record audio
2. The extracted content appears in the **Captured Text** panel (left)
3. Adjust the **Prompt** and the **Model** if needed
4. Click **✦ Send AI** to get the answer
5. The answer appears in the **AI Response** panel (right)
6. Use **Copy** to copy the result or **Save** to store it in the Meetings tab

### Clear button

**Clear** (next to **✦ Send AI**) erases the Captured Text panel, hides the AI Response panel and hides the Copy and Save buttons.

> Starting a new recording also clears the previous response automatically.

### Save button

**Save** only appears after the AI returns a response. It stores the whole session (captured text + AI response + provider + model + duration) in the **Meetings** tab.

### Active provider (badge)

The **colored badge** next to the capture buttons shows which AI provider is active:
- **Gemini** — indigo
- **OpenAI** — emerald
- **Claude** — orange
- **OpenCode Go** — blue

---

## Transcriptions

Automatic real-time speech transcription, 100% local with Whisper.

### How to use

1. Click **Transcriptions** in the sidebar
2. Click **Start** — the **first time** you use a model it is downloaded automatically (~77 MB for Fast, ~249 MB for Balanced); wait for the progress
3. The button shows a **timer** (e.g. `00:45`) while recording
4. Speak normally — transcriptions appear in real time in the log
5. Click **Stop** — the timer disappears and the **total recorded time** is shown
6. Click one of the summary buttons to process the text with AI

> **Note:** You cannot switch sections while a transcription is active. A warning appears if you try.

### AI model selector

At the top there is a **model selector** (dropdown) and a badge with the active provider — identical to Home. You can change the model without leaving the page; the change syncs with the Home selector.

### About Whisper

- Model: **Balanced** (`whisper-small`, ~249 MB, default), **Fast** (`whisper-base`, ~77 MB) or **Precise** (NVIDIA Parakeet V3, ~650 MB), chosen in Settings → Transcription model — downloaded automatically on first use
- Runs **100% on your computer** — no audio is sent to external servers
- Language is set in Settings (Brazilian Portuguese and English have good accuracy)
- 10-second chunks with silence detection — silent audio is ignored

### AI summary types

| Button | Result |
|---|---|
| **Short summary** | 3 to 5 sentences with the main points; plain text |
| **Detailed summary** | Full analysis: topic, key points, decisions, action items; in paragraphs |
| **Agenda-based AI summary** | Summary structured by agenda topic: what was discussed, decisions and action items per topic |

---

## Meetings

History of every saved session (Home and Transcriptions).

### Table

- **Date** — when the session was created; `DD/MM/YYYY HH:MM` in Portuguese, `MM/DD/YYYY hh:mm AM/PM` in English
- **Type** — amber badge = Quick Actions (saved from Home), indigo badge = Transcriptions
- **Provider** — AI model used
- **Duration** — recorded seconds
- **Summary** — preview of the AI response
- **Actions** — edit ✏️ or delete 🗑️

### Search

Type any term in the search bar to filter by summary, transcript or provider.

### Edit a session

Click ✏️ to open the edit modal. The text fields don't trigger the browser spell checker (no red underline). You can change any field (summary, transcript, prompt, model) and save.

### Delete a session

Click 🗑️ and confirm to remove the record permanently.

---

## Settings

Open it by clicking **Settings** (gear) in the sidebar.

### Gemini provider

Set the API key and choose the model:

| Model | When to use |
|---|---|
| `gemini-3.5-flash-lite` | Maximum speed, simple tasks |
| `gemini-3.6-flash` | **Recommended** — fast and accurate |
| `gemini-3.8-flash` | Complex questions that need more reasoning |

### OpenAI provider (GPT)

Set the API key and choose the model:

| Model | When to use |
|---|---|
| `gpt-4o-mini` | Fast, low cost |
| `gpt-4o` | More capable, balanced |
| `gpt-4.1-mini` | Lightweight GPT-4.1 |
| `gpt-4.1` | High capability |

### OpenCode Go provider

Models: `kimi-k3` (recommended), `deepseek-v4.1-flash` (fastest), `glm-5.3-flash` (balanced) and `kimi-k3.1-pro` (most accurate). OpenCode Go does not accept audio: when you record, the app first transcribes it with OpenAI Whisper or Gemini, so one of those keys must be configured.

### Anthropic provider (Claude)

Set the API key and choose the model:

| Model | When to use |
|---|---|
| `claude-haiku-4` | Fastest and cheapest |
| `claude-sonnet-4` | **Recommended** — balance of speed and quality |
| `claude-opus-4` | Maximum capability |

### Transcription model

Choose the Whisper model used on the Transcriptions page. The change applies the next time you click **Start**.

| Model | Download | When to use |
|---|---|---|
| **Fast** (`whisper-base`) | ~77 MB | Slower computer, English or clean audio |
| **Balanced** (`whisper-small`) | ~249 MB | **Default** — much better accuracy, especially in Portuguese |
| **Precise** (Parakeet V3) | ~650 MB | Most accurate and fastest in our Portuguese tests; biggest download |

### About

The **About** card has the link to support the project (Buy me a coffee), which opens in your default browser. The same link is in the sidebar footer.

### Switching provider

Each provider has a **toggle** on its settings page. Enabling one disables the previous one. The badge on Home changes to show the active provider.

> **Anthropic on Home:** Claude does not accept audio input, so when recording with Anthropic active the app captures a local transcript with the Web Speech API and sends the text to the AI (instead of the audio).

## Prompt template

The **Prompt** field on Home defines the context or instruction sent with the captured text. Examples:

```
Answer in English. Pick the correct option and explain in 1 sentence.
```
```
Summarize the text in up to 3 short bullet points.
```
```
You are a tax law expert. Analyze the text and highlight the critical points.
```

> Leave it empty to use the default prompt defined in `.env`.

---

## Theme (light / dark)

The **Theme** button in the sidebar switches between Light and Dark. The preference is saved automatically and applied the next time you open the app.

---

## Keyboard shortcut

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+F9` | Show / hide the app window |

> **Why not `Ctrl+Shift+Space`?** On Linux that shortcut is captured by IBus (Asian-language input method) before it reaches the app.

The red **Hide now** button in the sidebar does the same — handy to quickly hide the app during a presentation.

---

## Privacy and security

- **Transcription** — processed **100% locally** by Whisper; no audio is sent to external servers
- **OCR** — processed locally by Tesseract; no images are sent
- **AI** — text and audio are sent to the provider **only** when you click Send AI or stop a recording
- **API keys** — stored with the operating system's native encryption (Electron `safeStorage`)
- **Invisible window** — `setContentProtection(true)` keeps the window out of screen recordings/streams
- **Database** — stored only on your computer, at `~/.config/openfatoai/fato-ai.db`; nothing is sent to project servers

---

## Suggested workflow

```
1. Spot the question/content on your screen
         ↓
2. Use "Select Screen Area" to capture only the relevant part
         ↓
3. Check the extracted text in the Captured Text panel
         ↓
4. Adjust the prompt and the model if needed
         ↓
5. Click "Send AI" and read the answer in the right panel
         ↓
6. Click "Save" to keep it in the Meetings tab
         ↓
7. Hide the app with Ctrl+Shift+F9
```

---

## Troubleshooting

### "No screenshot binary found"
Install `scrot`:
```bash
sudo apt install scrot
```

### Gemini API 404 error
The selected model may not be available for your key. Switch to `gemini-3.6-flash` in Settings.

### "Configure your API key" banner
Go to Settings, enter the key of the active provider and click **Save settings**.

### OCR text is inaccurate
- Use **Select Area** instead of a full-screen capture
- Make sure `tesseract-ocr-por` is installed for Portuguese text (Linux/macOS), or that the Portuguese language pack was selected when installing Tesseract (Windows)

### Whisper is slow the first time
The chosen model (~77 MB or ~249 MB) is downloaded automatically only once. A progress bar is shown during the download.
