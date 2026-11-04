const logEl = document.getElementById('log');
const aiResponseEl = document.getElementById('aiResponse');
const aiResponseHeader = document.getElementById('aiResponseHeader');
const aiResponseCopyBtn = document.getElementById('aiResponseCopyBtn');
const startBtn = document.getElementById('startRec');
const stopBtn = document.getElementById('stopRec');
const screenshotOcrBtn = document.getElementById('screenshotOcr');
const regionOcrBtn = document.getElementById('regionOcr');
const hideBtn = document.getElementById('hideBtn');
const saveCfgBtn = document.getElementById('saveCfg');
const apiKeyInput = document.getElementById('apiKeyInput');
const openApiKeyUrlBtn = document.getElementById('openApiKeyUrl');
const bannerGoSettingsBtn = document.getElementById('bannerGoSettings');
const geminiEnableToggle = document.getElementById('geminiEnableToggle');
const openaiActiveToggle = document.getElementById('openai-active');

const openaiApiKeyInput  = document.getElementById('openai-api-key');
const openaiKeyError     = document.getElementById('openaiKeyError');
const openaiModelSelect  = document.getElementById('openaiModelSelect');
const anthropicaiActiveToggle = document.getElementById('anthropicai-active');
const anthropicaiApiKeyInput  = document.getElementById('anthropicai-api-key');
const anthropicKeyError       = document.getElementById('anthropicKeyError');
const anthropicModelSelect    = document.getElementById('anthropicModelSelect');
const openAnthropicKeyUrlBtn  = document.getElementById('openAnthropicKeyUrl');
const openOpenAIKeyUrlBtn = document.getElementById('openOpenAIKeyUrl');
const opencodegoActiveToggle = document.getElementById('opencodego-active');
const opencodegoApiKeyInput  = document.getElementById('opencodego-api-key');
const opencodegoKeyError     = document.getElementById('opencodegoKeyError');
const opencodegoModelSelect  = document.getElementById('opencodegoModelSelect');
const openOpenCodeGoKeyUrlBtn = document.getElementById('openOpenCodeGoKeyUrl');

const sendAiBtn     = document.getElementById('sendAiBtn');
const clearHomeBtn  = document.getElementById('clearHomeBtn');
const copyHomeBtn   = document.getElementById('copyHomeBtn');
const homeSaveBtn   = document.getElementById('homeSaveBtn');
const modelSelect = document.getElementById('geminiModelSelect');
const modelSelectHome = document.getElementById('geminiModelSelectHome');
const modelSelectTranscriptions   = document.getElementById('modelSelectTranscriptions');
const activeAiBadgeTranscriptions = document.getElementById('activeAiBadgeTranscriptions');
const modelInput = null;
const endpointInput = null;
const promptTemplateInput = document.getElementById('promptTemplate');

const DEFAULT_PROMPT = () => window.t('default.prompt');

function setBtnLoading(btn, loading, loadingText) {
  const spinner = btn.querySelector('.btn-spinner');
  const icon = btn.querySelector('.btn-icon');
  const label = btn.querySelector('.btn-label');
  if (spinner) spinner.classList.toggle('hidden', !loading);
  if (icon) icon.classList.toggle('hidden', loading);
  if (label) label.textContent = loading ? loadingText : (label.dataset.default || label.textContent);
}

function log(...args) {
  const s = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  logEl.textContent += s + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

let mediaRecorder = null;
let recordedChunks = [];
let recordingTimerInterval = null;
let recordingSeconds = 0;

// ── Home screen session state ─────────────────────────────────────────────────
// A new UUID is generated every time the user starts a new capture action.
// ON CONFLICT(session_hash) DO UPDATE in the DB prevents duplicate rows.
let _homeSessionHash     = null;
let _homeRecordedSeconds = 0;   // saved before stopTimer() resets recordingSeconds

/** Generate a fresh session hash and hide the Save button. */
function _newHomeSession() {
  _homeSessionHash     = crypto.randomUUID();
  _homeRecordedSeconds = 0;
  if (homeSaveBtn)   { homeSaveBtn.style.display = 'none'; homeSaveBtn.disabled = true; }
  if (sendAiBtn)     sendAiBtn.classList.add('hidden');
  if (clearHomeBtn)  clearHomeBtn.classList.add('hidden');
  if (copyHomeBtn)   copyHomeBtn.classList.add('hidden');
}

/** Show the Save button only when there is actual AI response text. */
function _maybeShowHomeSave() {
  const hasResponse = aiResponseEl && aiResponseEl.textContent.trim().length > 0;
  if (homeSaveBtn) {
    homeSaveBtn.style.display = hasResponse ? 'flex' : 'none';
    homeSaveBtn.disabled = !hasResponse;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// Web Speech API used for local transcription when provider is Anthropic
let anthropicTranscript = '';
let anthropicInterimTranscript = '';
let speechRecognitionInstance = null;

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

function startTimer() {
  recordingSeconds = 0;
  const startLabel = startBtn && (startBtn.querySelector('[data-i18n="btn.startRec"]') || startBtn.querySelector('span'));
  if (startLabel && startLabel.dataset && !startLabel.dataset.default) startLabel.dataset.default = startLabel.textContent;
  if (startLabel) startLabel.textContent = `${window.t('btn.recording')} ${formatTime(0)}`;
  recordingTimerInterval = setInterval(() => {
    recordingSeconds++;
    const formatted = formatTime(recordingSeconds);
    if (startLabel) startLabel.textContent = `${window.t('btn.recording')} ${formatted}`;
  }, 1000);
}

function stopTimer() {
  if (recordingTimerInterval) {
    clearInterval(recordingTimerInterval);
    recordingTimerInterval = null;
  }
  const startLabel = startBtn && (startBtn.querySelector('[data-i18n="btn.startRec"]') || startBtn.querySelector('span'));
  if (startLabel && startLabel.dataset && startLabel.dataset.default) startLabel.textContent = startLabel.dataset.default;
  recordingSeconds = 0;
}

startBtn.addEventListener('click', async () => {
  // IMEDIATAMENTE desabilitar/habilitar botões antes de qualquer await
  startBtn.disabled = true;
  stopBtn.disabled = false;
  screenshotOcrBtn.disabled = true;
  regionOcrBtn.disabled = true;

  // New recording session → fresh hash + hide Save button
  _newHomeSession();
  let _homeRecordingStartTime = Date.now();
  // Clear previous AI response so the panel doesn't show stale data
  if (aiResponseEl) { aiResponseEl.textContent = ''; aiResponseEl.classList.add('hidden'); }
  if (aiResponseHeader) aiResponseHeader.classList.add('hidden');
  if (aiResponseCopyBtn) aiResponseCopyBtn.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || 'audio/webm' });

      // Try to detect silence by decoding audio and checking RMS. If decoding fails,
      // fall back to a conservative size threshold.
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
          const channelData = decoded.getChannelData(0) || new Float32Array(0);
          let sum = 0;
          for (let i = 0; i < channelData.length; i++) sum += channelData[i] * channelData[i];
          const rms = channelData.length ? Math.sqrt(sum / channelData.length) : 0;
          try { audioCtx.close(); } catch (_) {}
          // Threshold: RMS below 0.01 considered silence (tweakable)
          if (rms < 0.01 || recordedChunks.length === 0) {
            log(`Áudio silencioso detectado (rms=${rms.toFixed(5)});`);
            setBtnLoading(stopBtn, false, window.t('btn.stopRec'));
            return;
          }
        }
      } catch (e) {
        // Decoding failed — fall back to size-based heuristic
        if (!blob || blob.size < 3000 || recordedChunks.length === 0) {
          log('Nenhum áudio significativo capturado (fallback por tamanho);');
          setBtnLoading(stopBtn, false, window.t('btn.stopRec'));
          return;
        }
      }

      // Anthropic: use locally collected Web Speech API transcript → sendText
      if (activeAiSource === 'anthropic') {
        const fullTranscript = (anthropicTranscript + anthropicInterimTranscript).trim();
        speechRecognitionInstance = null;
        if (fullTranscript) {
          const prompt = (promptTemplateInput && promptTemplateInput.value.trim()) || null;
          const model  = getActiveModel() || null;
          log(window.t('ai.sending.anthropic'));
          if (aiResponseHeader) aiResponseHeader.classList.remove('hidden');
          if (aiResponseEl) { aiResponseEl.classList.remove('hidden'); aiResponseEl.textContent = window.t('ai.waiting'); }
          try {
            const audioDurationSeconds = (Date.now() - _homeRecordingStartTime) / 1000;
            const res = await window.electronAPI.sendText({ text: fullTranscript, prompt, model, audioDurationSeconds });
            if (res && res.ok) {
              const aiText = extractAiText(res) || JSON.stringify(res.result);
              if (aiResponseEl) aiResponseEl.textContent = aiText;
              log(window.t('ai.received'));
              _maybeShowHomeSave();
            } else {
              const errMsg = res && res.error ? res.error : JSON.stringify(res);
              if (aiResponseEl) aiResponseEl.textContent = window.t('error.prefix') + errMsg;
              log(window.t('error.prefix'), errMsg);
            }
          } catch (e) {
            if (aiResponseEl) aiResponseEl.textContent = window.t('error.exception') + e.message;
          } finally {
            setBtnLoading(stopBtn, false, window.t('btn.stopRec'));
            startBtn.disabled = false;
            screenshotOcrBtn.disabled = false;
            regionOcrBtn.disabled = false;
          }
          return;
        }
        // SpeechRecognition not available or returned nothing — fall through to sendAudio
        // (main process will return a friendly error explaining the limitation)
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result;
          const base64 = dataUrl.split(',')[1];
          log(aiSendingMsg());
          if (aiResponseHeader) aiResponseHeader.classList.remove('hidden');
          if (aiResponseEl) { aiResponseEl.classList.remove('hidden'); aiResponseEl.textContent = window.t('ai.waiting'); }
          const res = await window.electronAPI.sendAudio({ mimeType: blob.type, base64 });
          if (res && res.ok) {
            const aiText = extractAiText(res) || JSON.stringify(res.result);
            if (aiResponseEl) aiResponseEl.textContent = aiText;
            log(window.t('ai.received'));
            _maybeShowHomeSave();
          } else {
            const errMsg = res && res.error ? res.error : JSON.stringify(res);
            if (aiResponseEl) aiResponseEl.textContent = window.t('error.prefix') + errMsg;
            log(window.t('error.prefix'), errMsg);
          }
        } finally {
          setBtnLoading(stopBtn, false, window.t('btn.stopRec'));
          startBtn.disabled = false;
          screenshotOcrBtn.disabled = false;
          regionOcrBtn.disabled = false;
        }
      };
      reader.readAsDataURL(blob);
    };
    // Anthropic doesn't support audio input — capture transcript locally via Web Speech API
    if (activeAiSource === 'anthropic') {
      anthropicTranscript = '';
      anthropicInterimTranscript = '';
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        speechRecognitionInstance = new SpeechRec();
        speechRecognitionInstance.continuous = true;
        speechRecognitionInstance.interimResults = true;
        speechRecognitionInstance.lang = navigator.language || 'pt-BR';
        speechRecognitionInstance.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) anthropicTranscript += t + ' ';
            else interim += t;
          }
          anthropicInterimTranscript = interim;
        };
        speechRecognitionInstance.onerror = () => {};
        speechRecognitionInstance.start();
      }
    }

    mediaRecorder.start();
    logEl.textContent = '';
    startTimer();
    log(window.t('log.rec.started'));
  } catch (e) {
    log(window.t('log.rec.error'), e.message);
  }
});

stopBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    setBtnLoading(stopBtn, true, window.t('btn.stopRec.loading'));
    // Stop SpeechRecognition first so it can flush final results before onstop runs
    if (speechRecognitionInstance) {
      try { speechRecognitionInstance.stop(); } catch (_) {}
    }
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
    screenshotOcrBtn.disabled = false;
    regionOcrBtn.disabled = false;
    if (clearHomeBtn)  clearHomeBtn.classList.remove('hidden');
    if (copyHomeBtn)   copyHomeBtn.classList.remove('hidden');
    // Capture elapsed seconds before stopTimer() resets recordingSeconds to 0
    _homeRecordedSeconds = recordingSeconds;
    stopTimer();
    log(window.t('log.rec.stopped'));
  }
});



// Detects the current OS ('windows', 'macos' or 'linux') via userAgent/platform
function _detectPlatform() {
  var ua = (navigator.userAgent || '') + ' ' + (navigator.platform || '');
  if (/Win/i.test(ua))    return 'windows';
  if (/Mac/i.test(ua))    return 'macos';
  return 'linux';
}

// Detects the current OS to show platform-specific Tesseract install instructions
function _detectPlatformOcrHelpKey() {
  return 'log.ocr.tesseractMissing.' + _detectPlatform();
}

// Region Select + OCR flow
let regionOcrRunning = false;
if (regionOcrBtn) {
  regionOcrBtn.addEventListener('click', async () => {
    if (regionOcrRunning) return;
    regionOcrRunning = true;
    // New capture session → fresh hash + hide Save
    _newHomeSession();
    logEl.textContent = '';
    if (aiResponseEl) { aiResponseEl.textContent = ''; aiResponseEl.classList.add('hidden'); }
    if (aiResponseHeader) aiResponseHeader.classList.add('hidden');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    try {
      const placeholders = Array.from(document.querySelectorAll('[placeholder]'))
        .map(el => el.getAttribute('placeholder') || '')
        .map(s => s.replace(/\n/g, ' ').trim())
        .filter(s => s.length > 0);

      const res = await window.electronAPI.captureRegionAndOcr(placeholders);
      if (res && res.ok) {
        log('\n' + (res.text || '').trim());
        if (sendAiBtn)    sendAiBtn.classList.remove('hidden');
        if (clearHomeBtn) clearHomeBtn.classList.remove('hidden');
        if (copyHomeBtn)  copyHomeBtn.classList.remove('hidden');
      } else if (res && res.error === 'TESSERACT_NOT_FOUND') {
        log(window.t('log.ocr.tesseractMissing.title') + ' ' + window.t(_detectPlatformOcrHelpKey()));
      } else {
        log('OCR de área falhou:', res && res.error ? res.error : JSON.stringify(res));
      }
    } catch (e) {
      log('captureRegionAndOcr exception:', e && e.message ? e.message : String(e));
    } finally {
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
      regionOcrRunning = false;
    }
  });
}

// Hide window immediately (panic button)
if (hideBtn) {
  hideBtn.addEventListener('click', () => {
    window.electronAPI.hideWindow();
  });
}

// Limpar Home — função extraída para reutilização
function _clearHome() {
  if (logEl)             logEl.textContent = '';
  _newHomeSession();
  if (aiResponseEl)      aiResponseEl.textContent = '';
  if (aiResponseHeader)  aiResponseHeader.classList.add('hidden');
  if (aiResponseCopyBtn) aiResponseCopyBtn.disabled = true;
}

// Limpar — apaga log, oculta resposta AI e botões de ação
if (clearHomeBtn) {
  clearHomeBtn.addEventListener('click', () => {
    console.log('Botão Limpando ...');
    _clearHome();
  });
}

// Enviar IA — manda o texto do log + prompt template para a Gemini
if (sendAiBtn) {
  sendAiBtn.addEventListener('click', async () => {
    const text = logEl.textContent.trim();
    if (!text) return;

    // Ensure there's a session hash (e.g. typed text without any prior capture)
    if (!_homeSessionHash) _homeSessionHash = crypto.randomUUID();

    const prompt = (promptTemplateInput && promptTemplateInput.value.trim())
      ? promptTemplateInput.value.trim()
      : null;
    const model = getActiveModel() || null;

    sendAiBtn.disabled = true;
    setBtnLoading(sendAiBtn, true, window.t('btn.sendAi.loading'));

    if (aiResponseHeader) aiResponseHeader.classList.remove('hidden');
    if (aiResponseEl) aiResponseEl.classList.remove('hidden');
    if (aiResponseEl) aiResponseEl.textContent = aiSendingMsg();

    try {
      const res = await window.electronAPI.sendText({ text, prompt, model });
      if (res && res.ok) {
        const aiText = extractAiText(res) || JSON.stringify(res.result);
        if (aiResponseEl) aiResponseEl.textContent = aiText;
        _maybeShowHomeSave();
      } else {
        if (aiResponseEl) aiResponseEl.textContent = window.t('error.prefix') + (res && res.error ? res.error : JSON.stringify(res));
      }
    } catch (e) {
      if (aiResponseEl) aiResponseEl.textContent = window.t('error.exception') + e.message;
    } finally {
      sendAiBtn.disabled = false;
      setBtnLoading(sendAiBtn, false, window.t('btn.sendAi'));
    }
  });
}

// Salvar — persiste dados da sessão Home na tabela meetings
if (homeSaveBtn) {
  homeSaveBtn.addEventListener('click', async () => {
    const aiText = aiResponseEl ? aiResponseEl.textContent.trim() : '';
    if (!aiText || !_homeSessionHash) return; // nothing to save

    homeSaveBtn.disabled = true;

    try {

      const payload = {
        session_hash:     _homeSessionHash,
        meeting_type:     1,   // Ações Rápidas (Home)
        summary_type:     'home',
        transcript_text:  logEl ? logEl.textContent.trim() || null : null,
        ai_summary:       aiText,
        prompt_used:      (promptTemplateInput && promptTemplateInput.value.trim()) || null,
        recorded_seconds: _homeRecordedSeconds,
        ai_provider:      activeAiSource || null,
        ai_model:         getActiveModel() || null,
        language:         window.getCurrentLang ? window.getCurrentLang() : null,
      };
      const res = await window.electronAPI.saveTranscription(payload);
      if (res && res.ok !== false) {
        log(window.t('home.save.success') || 'Salvo com sucesso.');
      } else {
        log('Erro ao salvar:', res && res.error ? res.error : JSON.stringify(res));
      }
    } catch (e) {
      log('Exceção ao salvar:', e.message);
    } finally {
      homeSaveBtn.disabled = false;
    }
  });
}

// Screenshot + OCR flow
if (screenshotOcrBtn) {
  screenshotOcrBtn.addEventListener('click', async () => {
    // New capture session → fresh hash + hide Save
    _newHomeSession();
    // clear the log and AI response before running OCR
    try { logEl.textContent = ''; } catch (_) {}   // eslint-disable-line no-unused-vars
    if (aiResponseEl) { aiResponseEl.textContent = ''; aiResponseEl.classList.add('hidden'); }
    if (aiResponseHeader) aiResponseHeader.classList.add('hidden');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    try {
      // gather all placeholder texts from the DOM to exclude them from OCR results
      const placeholders = Array.from(document.querySelectorAll('[placeholder]'))
        .map(el => el.getAttribute('placeholder') || '')
        .map(s => s.replace(/\n/g, ' ').trim())
        .filter(s => s.length > 0);

      // captureAndOcr exposed in preload returns a function (see preload), call with placeholders
      const captureFn = await window.electronAPI.captureAndOcr();
      const res = await captureFn(placeholders);
      if (res && res.ok) {
        log((res.text || '').trim());
        if (sendAiBtn)    sendAiBtn.classList.remove('hidden');
        if (clearHomeBtn) clearHomeBtn.classList.remove('hidden');
        if (copyHomeBtn)  copyHomeBtn.classList.remove('hidden');
      } else {
        log('OCR failed:', res && res.error ? res.error : JSON.stringify(res));
      }
    } catch (e) {
      log('captureAndOcr exception:', e && e.message ? e.message : String(e));
    } finally {
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
  });
}

async function fallbackCaptureDisplayMedia() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error('getDisplayMedia not available in this environment');
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  // capture one frame
  const track = stream.getVideoTracks()[0];
  const imageCapture = new ImageCapture ? new ImageCapture(track) : null;
  // draw to canvas as a fallback
  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  await new Promise((resolve) => { video.onloadedmetadata = () => resolve(); });
  // ensure a frame is available
  await new Promise(r => setTimeout(r, 200));
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  // stop tracks
  try { track.stop(); } catch (_) {}
  // return data URL
  return canvas.toDataURL('image/png');
}

function getActiveModel() {
  if (activeAiSource === 'openai') {
    return (modelSelectHome && modelSelectHome.value) || (openaiModelSelect && openaiModelSelect.value);
  }
  return (modelSelectHome && modelSelectHome.value) || (modelSelect && modelSelect.value);
}

function syncModelSelects(value) {
  // Only set the Gemini page select if the value is a valid Gemini model
  if (modelSelect) {
    const isGeminiVal = _aiModels.gemini.some(m => m.value === value);
    if (isGeminiVal) modelSelect.value = value;
  }
  if (modelSelectHome) modelSelectHome.value = value;
}

if (modelSelectHome) {
  modelSelectHome.addEventListener('change', async () => {
    if (modelSelect) modelSelect.value = modelSelectHome.value;
    if (modelSelectTranscriptions) modelSelectTranscriptions.value = modelSelectHome.value;
    const cfg = {};
    if (promptTemplateInput && promptTemplateInput.value) cfg.sourceAIPrompt = promptTemplateInput.value;
    cfg.sourceAIModel = modelSelectHome.value;
    await window.electronAPI.saveConfig(cfg);
  });
}

if (modelSelectTranscriptions) {
  modelSelectTranscriptions.addEventListener('change', async () => {
    const val = modelSelectTranscriptions.value;
    if (modelSelectHome)        modelSelectHome.value = val;
    await window.electronAPI.saveConfig({ sourceAIModel: val });
  });
}

if (modelSelect) {
  modelSelect.addEventListener('change', () => {
    // Sync Home select only when Gemini is active
    if (activeAiSource === 'gemini' && modelSelectHome) modelSelectHome.value = modelSelect.value;
    if (activeAiSource === 'gemini') {
      window.electronAPI.saveConfig({ sourceAIModel: modelSelect.value });
    }
  });
}

if (opencodegoModelSelect) {
  opencodegoModelSelect.addEventListener('change', () => {
    if (activeAiSource === 'opencodego' && modelSelectHome) modelSelectHome.value = opencodegoModelSelect.value;
    if (activeAiSource === 'opencodego') {
      window.electronAPI.saveConfig({ opencodegoModel: opencodegoModelSelect.value, sourceAIModel: opencodegoModelSelect.value });
    }
  });
}

if (openaiModelSelect) {
  openaiModelSelect.addEventListener('change', () => {
    if (activeAiSource === 'openai' && modelSelectHome) modelSelectHome.value = openaiModelSelect.value;
    if (activeAiSource === 'openai') {
      window.electronAPI.saveConfig({ openaiModel: openaiModelSelect.value, sourceAIModel: openaiModelSelect.value });
    }
  });
}

function showToastSaved() {
  const toast = document.getElementById('toastSaved');
  if (!toast) return;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-8px)';
  }, 2500);
}

// ── API Key ───────────────────────────────────────────────────────
// Sentinela que indica "chave já configurada" — nunca é a chave real
const MASKED_KEY = '\u25cf'.repeat(39);
const MASKED_OPENAI_KEY = '\u25cf'.repeat(32);
const MASKED_ANTHROPIC_KEY = '\u25cf'.repeat(32);
const MASKED_OPENCODEGO_KEY = '\u25cf'.repeat(32);

async function checkApiKeyBanner() {
  const banner = document.getElementById('noApiKeyBanner');
  // Banner shows only when the active provider has no key configured
  let hasKey = false;
  if (activeAiSource === 'openai') {
    const res = await window.electronAPI.hasOpenAIKey();
    hasKey = res && res.has;
  } else if (activeAiSource === 'opencodego') {
    const res = await window.electronAPI.hasOpenCodeGoKey();
    hasKey = res && res.has;
  } else if (activeAiSource === 'anthropic') {
    const res = await window.electronAPI.hasAnthropicKey();
    hasKey = res && res.has;
  } else {
    const res = await window.electronAPI.hasApiKey();
    hasKey = res && res.has;
  }

  if (banner) {
    banner.classList.toggle('hidden', hasKey);
    banner.classList.toggle('flex', !hasKey);
  }
  // disable action buttons until a key is configured
  [startBtn, screenshotOcrBtn, regionOcrBtn].filter(Boolean).forEach(btn => {
    btn.disabled = !hasKey;
  });
  // mostre o sentinela no campo quando há chave; caso contrário limpe
  if (apiKeyInput) {
    const geminiRes = await window.electronAPI.hasApiKey();
    const hasGeminiKey = geminiRes && geminiRes.has;
    if (hasGeminiKey) {
      apiKeyInput.value = MASKED_KEY;
      apiKeyInput.type = 'text';
      apiKeyInput.placeholder = '';
    } else {
      apiKeyInput.value = '';
      apiKeyInput.type = 'password';
      apiKeyInput.placeholder = window.t('placeholder.apiKey');
    }
  }
  {
    const openaiRes = await window.electronAPI.hasOpenAIKey();
    const hasOpenAIKey = openaiRes && openaiRes.has;
    if (openaiActiveToggle) openaiActiveToggle.disabled = !hasOpenAIKey;
    if (openaiApiKeyInput) {
      if (hasOpenAIKey) {
        openaiApiKeyInput.value = MASKED_OPENAI_KEY;
        openaiApiKeyInput.type = 'text';
        openaiApiKeyInput.placeholder = '';
      } else {
        openaiApiKeyInput.value = '';
        openaiApiKeyInput.type = 'password';
        openaiApiKeyInput.placeholder = window.t('openai.key.placeholder');
      }
    }
  }
  {
    const opencodegoRes = await window.electronAPI.hasOpenCodeGoKey();
    const hasOpenCodeGoKey = opencodegoRes && opencodegoRes.has;
    if (opencodegoActiveToggle) opencodegoActiveToggle.disabled = !hasOpenCodeGoKey;
    if (opencodegoApiKeyInput) {
      if (hasOpenCodeGoKey) {
        opencodegoApiKeyInput.value = MASKED_OPENCODEGO_KEY;
        opencodegoApiKeyInput.type = 'text';
        opencodegoApiKeyInput.placeholder = '';
      } else {
        opencodegoApiKeyInput.value = '';
        opencodegoApiKeyInput.type = 'password';
        opencodegoApiKeyInput.placeholder = window.t('opencodego.key.placeholder');
      }
    }
  }
  {
    const anthropicRes = await window.electronAPI.hasAnthropicKey();
    const hasAnthropicKey = anthropicRes && anthropicRes.has;
    if (anthropicaiActiveToggle) anthropicaiActiveToggle.disabled = !hasAnthropicKey;
    if (anthropicaiApiKeyInput) {
      if (hasAnthropicKey) {
        anthropicaiApiKeyInput.value = MASKED_ANTHROPIC_KEY;
        anthropicaiApiKeyInput.type = 'text';
        anthropicaiApiKeyInput.placeholder = '';
      } else {
        anthropicaiApiKeyInput.value = '';
        anthropicaiApiKeyInput.type = 'password';
        anthropicaiApiKeyInput.placeholder = window.t('anthropic.key.placeholder');
      }
    }
  }
}

// Ao clicar no campo com o sentinela, limpar para o usuário digitar a nova chave
// Ao sair sem digitar nada, restaurar o sentinela se já havia chave salva
if (apiKeyInput) {
  apiKeyInput.addEventListener('focus', () => {
    if (apiKeyInput.value === MASKED_KEY) {
      apiKeyInput.value = '';
      apiKeyInput.type = 'password';
      apiKeyInput.placeholder = window.t('placeholder.apiKey');
    }
  });
  apiKeyInput.addEventListener('blur', async () => {
    if (apiKeyInput.value.trim() === '') {
      const res = await window.electronAPI.hasApiKey();
      if (res && res.has) {
        apiKeyInput.value = MASKED_KEY;
        apiKeyInput.type = 'text';
        apiKeyInput.placeholder = '';
      }
    }
  });
}

if (openApiKeyUrlBtn) {
  openApiKeyUrlBtn.addEventListener('click', () => window.electronAPI.openApiKeyUrl());
}

if (openOpenCodeGoKeyUrlBtn) {
  openOpenCodeGoKeyUrlBtn.addEventListener('click', () => window.electronAPI.openOpenCodeGoKeyUrl());
}

if (openOpenAIKeyUrlBtn) {
  openOpenAIKeyUrlBtn.addEventListener('click', () => window.electronAPI.openOpenAIKeyUrl());
}

if (openAnthropicKeyUrlBtn) {
  openAnthropicKeyUrlBtn.addEventListener('click', () => window.electronAPI.openAnthropicKeyUrl());
}

// Anthropic key input sentinel
if (anthropicaiApiKeyInput) {
  anthropicaiApiKeyInput.addEventListener('focus', () => {
    if (anthropicaiApiKeyInput.value === MASKED_ANTHROPIC_KEY) {
      anthropicaiApiKeyInput.value = '';
      anthropicaiApiKeyInput.type = 'password';
      anthropicaiApiKeyInput.placeholder = window.t('anthropic.key.placeholder');
    }
  });
  anthropicaiApiKeyInput.addEventListener('blur', async () => {
    if (anthropicaiApiKeyInput.value.trim() === '') {
      const res = await window.electronAPI.hasAnthropicKey();
      if (res && res.has) {
        anthropicaiApiKeyInput.value = MASKED_ANTHROPIC_KEY;
        anthropicaiApiKeyInput.type = 'text';
        anthropicaiApiKeyInput.placeholder = '';
      }
    }
  });
}

// OpenCode Go key input sentinel
if (opencodegoApiKeyInput) {
  opencodegoApiKeyInput.addEventListener('focus', () => {
    if (opencodegoApiKeyInput.value === MASKED_OPENCODEGO_KEY) {
      opencodegoApiKeyInput.value = '';
      opencodegoApiKeyInput.type = 'password';
      opencodegoApiKeyInput.placeholder = window.t('opencodego.key.placeholder');
    }
  });
  opencodegoApiKeyInput.addEventListener('blur', async () => {
    if (opencodegoApiKeyInput.value.trim() === '') {
      const res = await window.electronAPI.hasOpenCodeGoKey();
      if (res && res.has) {
        opencodegoApiKeyInput.value = MASKED_OPENCODEGO_KEY;
        opencodegoApiKeyInput.type = 'text';
        opencodegoApiKeyInput.placeholder = '';
      }
    }
  });
}

// OpenAI key input sentinel
if (openaiApiKeyInput) {
  openaiApiKeyInput.addEventListener('focus', () => {
    if (openaiApiKeyInput.value === MASKED_OPENAI_KEY) {
      openaiApiKeyInput.value = '';
      openaiApiKeyInput.type = 'password';
      openaiApiKeyInput.placeholder = window.t('openai.key.placeholder');
    }
  });
  openaiApiKeyInput.addEventListener('blur', async () => {
    if (openaiApiKeyInput.value.trim() === '') {
      const res = await window.electronAPI.hasOpenAIKey();
      if (res && res.has) {
        openaiApiKeyInput.value = MASKED_OPENAI_KEY;
        openaiApiKeyInput.type = 'text';
        openaiApiKeyInput.placeholder = '';
      }
    }
  });
}

if (bannerGoSettingsBtn) {
  bannerGoSettingsBtn.addEventListener('click', () => {
    document.querySelector('[data-nav="gemini-ai"]')?.click();
  });
}

// ── AI Source Toggle ─────────────────────────────────────────────
const _MODEL_LABELS = {
  'claude-opus-4-8':           'Opus 4.8 (Mais Capaz)',
  'claude-opus-4-7':           'Opus 4.7',
  'claude-sonnet-4-6':         'Sonnet 4.6 (Recomendado)',
  'claude-haiku-4-5-20251001': 'Haiku 4.5 (Mais Rápido)',
  'gpt-4o':                    'GPT-4o (Recomendado)',
  'gpt-4o-mini':               'GPT-4o Mini (Rápido)',
  'gpt-4.1':                   'GPT-4.1 (Mais Preciso)',
  'gpt-4.1-mini':              'GPT-4.1 Mini',
  'o1':                        'o1 (Raciocínio)',
  'o3-mini':                   'o3-mini (Raciocínio Rápido)',
  'kimi-k3':                   'Kimi K3 (Recomendado)',
  'deepseek-v4.1-flash':       'DeepSeek V4.1 Flash (Rápido)',
  'glm-5.3-flash':             'GLM-5.3 Flash (Equilibrado)',
  'kimi-k3.1-pro':             'Kimi K3.1 Pro (Mais Preciso)',
  'gemini-3.6-flash':          'Gemini 3.6 Flash (Recomendado)',
  'gemini-3.5-flash-lite':     'Gemini 3.5 Flash Lite (Rápido)',
  'gemini-3.8-flash':          'Gemini 3.8 Flash (Mais Preciso)',
};

const _AI_DEFAULTS = {
  anthropic: ['claude-opus-4-8', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai:    ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini', 'gpt-4.1', 'gpt-4.1-mini'],
  opencodego: ['kimi-k3', 'deepseek-v4.1-flash', 'glm-5.3-flash', 'kimi-k3.1-pro'],
  gemini:    ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'],
};

let _aiModels = {
  anthropic: _AI_DEFAULTS.anthropic.map(v => ({ value: v, label: _MODEL_LABELS[v] || v })),
  openai:    _AI_DEFAULTS.openai.map(v => ({ value: v, label: _MODEL_LABELS[v] || v })),
  opencodego: _AI_DEFAULTS.opencodego.map(v => ({ value: v, label: _MODEL_LABELS[v] || v })),
  gemini:    _AI_DEFAULTS.gemini.map(v => ({ value: v, label: _MODEL_LABELS[v] || v })),
};

function _populateSettingsSelects() {
  const _setWithFallback = (sel, models) => {
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
    sel.value = models.some(m => m.value === prev) ? prev : (models[0]?.value || '');
  };
  _setWithFallback(modelSelect,          _aiModels.gemini);
  _setWithFallback(openaiModelSelect,    _aiModels.openai);
  _setWithFallback(anthropicModelSelect, _aiModels.anthropic);
  _setWithFallback(opencodegoModelSelect, _aiModels.opencodego);

  // Novos selects — Transcrições e Tradução
  const models = _aiModels[activeAiSource] || [];
  if (modelSelectTranscriptions) {
    const curVal = modelSelectTranscriptions.value;
    modelSelectTranscriptions.innerHTML =
      models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
    if (curVal) modelSelectTranscriptions.value = curVal;
  }
}

let activeAiSource = 'gemini';

function aiSendingMsg() {
  if (activeAiSource === 'openai') return window.t('ai.sending.openai');
  if (activeAiSource === 'opencodego') return window.t('ai.sending.opencodego');
  if (activeAiSource === 'anthropic') return window.t('ai.sending.anthropic');
  return window.t('ai.sending.gemini');
}

function extractAiText(res) {
  if (!res?.result) return null;
  const j = res.result.json;
  const geminiText = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (geminiText) return geminiText;
  const openaiText = j?.choices?.[0]?.message?.content;
  if (openaiText) return openaiText;
  const anthropicText = j?.content?.[0]?.text;
  if (anthropicText) return anthropicText;
  if (res.result.body && !res.result.json) return res.result.body;
  return null;
}

function applyActiveAiSource(source, save = true) {
  activeAiSource = source;

  // Toggles
  if (geminiEnableToggle) geminiEnableToggle.checked = source === 'gemini';
  if (openaiActiveToggle) openaiActiveToggle.checked = source === 'openai';
  if (anthropicaiActiveToggle) anthropicaiActiveToggle.checked = source === 'anthropic';
  if (opencodegoActiveToggle) opencodegoActiveToggle.checked = source === 'opencodego';

  // Flyout indicators
  const flyoutGeminiActive = document.getElementById('flyoutGeminiActive');
  const flyoutOpenaiActive = document.getElementById('flyoutOpenaiActive');
  const flyoutAnthropicActive = document.getElementById('flyoutAnthropicActive');
  if (flyoutGeminiActive) flyoutGeminiActive.classList.toggle('hidden', source !== 'gemini');
  if (flyoutOpenaiActive) flyoutOpenaiActive.classList.toggle('hidden', source !== 'openai');
  if (flyoutAnthropicActive) flyoutAnthropicActive.classList.toggle('hidden', source !== 'anthropic');
  const flyoutOpencodegoActive = document.getElementById('flyoutOpencodegoActive');
  if (flyoutOpencodegoActive) flyoutOpencodegoActive.classList.toggle('hidden', source !== 'opencodego');

  // Home badge
  const badge = document.getElementById('activeAiBadge');
  if (badge) {
    if (source === 'gemini') {
      badge.textContent = 'Gemini';
      badge.className = 'text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400';
    } else if (source === 'opencodego') {
      badge.textContent = 'OpenCode Go';
      badge.className = 'text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400';
    } else if (source === 'anthropic') {
      badge.textContent = 'Claude';
      badge.className = 'text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400';
    } else {
      badge.textContent = 'OpenAI';
      badge.className = 'text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400';
    }
  }

  // Home model select options
  if (modelSelectHome) {
    const models = _aiModels[source] || _aiModels.gemini;
    const currentVal = modelSelectHome.value;
    modelSelectHome.innerHTML = models
      .map(m => `<option value="${m.value}">${m.label}</option>`)
      .join('');
    const exists = models.some(m => m.value === currentVal);
    modelSelectHome.value = exists ? currentVal : models[0].value;
  }

  // Sync novos selects — Transcrições e Tradução
  {
    const models    = _aiModels[source] || [];
    const badgeText = source === 'opencodego' ? 'OpenCode Go' : source ? source.charAt(0).toUpperCase() + source.slice(1) : '';

    if (modelSelectTranscriptions) {
      const curVal = modelSelectTranscriptions.value;
      modelSelectTranscriptions.innerHTML =
        models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
      const homeVal = modelSelectHome?.value;
      modelSelectTranscriptions.value =
        (curVal && models.some(m => m.value === curVal)) ? curVal
        : homeVal ? homeVal
        : (models[0]?.value || '');
    }
    if (activeAiBadgeTranscriptions) activeAiBadgeTranscriptions.textContent = badgeText;
  }

  if (save) {
    window.electronAPI.saveConfig({ activeAiSource: source });
  }
}

if (geminiEnableToggle) {
  geminiEnableToggle.addEventListener('change', () => {
    if (!geminiEnableToggle.checked) { geminiEnableToggle.checked = true; return; }
    applyActiveAiSource('gemini');
  });
}

if (opencodegoActiveToggle) {
  opencodegoActiveToggle.addEventListener('change', () => {
    applyActiveAiSource(opencodegoActiveToggle.checked ? 'opencodego' : 'gemini');
  });
}

if (openaiActiveToggle) {
  openaiActiveToggle.addEventListener('change', () => {
    applyActiveAiSource(openaiActiveToggle.checked ? 'openai' : 'gemini');
  });
}

if (anthropicaiActiveToggle) {
  anthropicaiActiveToggle.addEventListener('change', () => {
    applyActiveAiSource(anthropicaiActiveToggle.checked ? 'anthropic' : 'gemini');
  });
}

if (anthropicModelSelect) {
  anthropicModelSelect.addEventListener('change', () => {
    if (activeAiSource === 'anthropic' && modelSelectHome) modelSelectHome.value = anthropicModelSelect.value;
    if (activeAiSource === 'anthropic') {
      window.electronAPI.saveConfig({ anthropicModel: anthropicModelSelect.value, sourceAIModel: anthropicModelSelect.value });
    }
  });
}

saveCfgBtn.addEventListener('click', async () => {
  const keyValue = apiKeyInput ? apiKeyInput.value.trim() : '';
  const isKeySentinel = keyValue === MASKED_KEY;

  function isValidGeminiKey(key) {
    return /^(?:AIza[0-9A-Za-z_\-]{35}|AQ\.[0-9A-Za-z_\-]{30,})$/.test(key);
  }

  const apiKeyError = document.getElementById('apiKeyError');

  function showKeyError(msg) {
    if (apiKeyInput) {
      apiKeyInput.focus();
      apiKeyInput.classList.add('ring-2', 'ring-red-500', 'border-red-400');
      setTimeout(() => apiKeyInput.classList.remove('ring-2', 'ring-red-500', 'border-red-400'), 3000);
    }
    if (apiKeyError) {
      apiKeyError.textContent = msg;
      apiKeyError.classList.remove('hidden');
      setTimeout(() => apiKeyError.classList.add('hidden'), 3000);
    }
  }

  if (apiKeyInput) {
    apiKeyInput.addEventListener('input', () => {
      if (apiKeyError) apiKeyError.classList.add('hidden');
    }, { once: true });
  }

  // Validação da chave Gemini apenas quando Gemini está ativo
  if (activeAiSource === 'gemini') {
    if (keyValue && !isKeySentinel && !isValidGeminiKey(keyValue)) {
      showKeyError(window.t('error.apiKey.invalid'));
      return;
    }
    const hasKeyRes = await window.electronAPI.hasApiKey();
    if (!hasKeyRes.has && (!keyValue || isKeySentinel)) {
      showKeyError(window.t('error.apiKey.required'));
      return;
    }
    if (keyValue && !isKeySentinel) {
      await window.electronAPI.saveApiKey(keyValue);
      if (apiKeyInput) apiKeyInput.value = '';
    }
  }

  const cfg = {};
  if (promptTemplateInput && promptTemplateInput.value) cfg.sourceAIPrompt = promptTemplateInput.value;
  const activeModel = getActiveModel();
  if (activeModel) cfg.sourceAIModel = activeModel;
  await window.electronAPI.saveConfig(cfg);
  showToastSaved();
  await checkApiKeyBanner();
});

// ── Save OpenCode Go settings ────────────────────────────────────
const saveOpenCodeGoCfgBtn = document.getElementById('opencodego-save-config');

if (saveOpenCodeGoCfgBtn) {
  saveOpenCodeGoCfgBtn.addEventListener('click', async () => {
    const keyValue      = opencodegoApiKeyInput ? opencodegoApiKeyInput.value.trim() : '';
    const isKeySentinel = keyValue === MASKED_OPENCODEGO_KEY;

    function showKeyError(msg) {
      if (opencodegoApiKeyInput) {
        opencodegoApiKeyInput.focus();
        opencodegoApiKeyInput.classList.add('ring-2', 'ring-red-500', 'border-red-400');
        setTimeout(() => opencodegoApiKeyInput.classList.remove('ring-2', 'ring-red-500', 'border-red-400'), 3000);
      }
      if (opencodegoKeyError) {
        opencodegoKeyError.textContent = msg;
        opencodegoKeyError.classList.remove('hidden');
        setTimeout(() => opencodegoKeyError.classList.add('hidden'), 3000);
      }
    }

    if (opencodegoApiKeyInput) {
      opencodegoApiKeyInput.addEventListener('input', () => {
        if (opencodegoKeyError) opencodegoKeyError.classList.add('hidden');
      }, { once: true });
    }

    if (keyValue && !isKeySentinel && !/^\S{16,}$/.test(keyValue)) {
      showKeyError(window.t('error.opencodegoKey.invalid'));
      return;
    }
    const hasKeyRes = await window.electronAPI.hasOpenCodeGoKey();
    if (!hasKeyRes.has && (!keyValue || isKeySentinel)) {
      showKeyError(window.t('error.opencodegoKey.required'));
      return;
    }
    if (keyValue && !isKeySentinel) {
      const saveRes = await window.electronAPI.saveOpenCodeGoKey(keyValue);
      if (!saveRes.ok) {
        showKeyError(saveRes.error || window.t('error.opencodegoKey.invalid'));
        return;
      }
      if (opencodegoApiKeyInput) opencodegoApiKeyInput.value = '';
    }

    const model = opencodegoModelSelect ? opencodegoModelSelect.value : 'kimi-k3';
    await window.electronAPI.saveConfig({ opencodegoModel: model });
    showToastSaved();
    // checkApiKeyBanner will enable the toggle now that a key is saved
    await checkApiKeyBanner();
  });
}

// ── Save OpenAI settings ─────────────────────────────────────────
const saveOpenAICfgBtn = document.getElementById('openai-save-config');

if (saveOpenAICfgBtn) {
  saveOpenAICfgBtn.addEventListener('click', async () => {
    const keyValue     = openaiApiKeyInput ? openaiApiKeyInput.value.trim() : '';
    const isKeySentinel = keyValue === MASKED_OPENAI_KEY;

    function isValidOpenAIKey(k) {
      return /^sk-[A-Za-z0-9_\-]{20,}$/.test(k);
    }

    function showOpenAIKeyError(msg) {
      if (openaiApiKeyInput) {
        openaiApiKeyInput.focus();
        openaiApiKeyInput.classList.add('ring-2', 'ring-red-500', 'border-red-400');
        setTimeout(() => openaiApiKeyInput.classList.remove('ring-2', 'ring-red-500', 'border-red-400'), 3000);
      }
      if (openaiKeyError) {
        openaiKeyError.textContent = msg;
        openaiKeyError.classList.remove('hidden');
        setTimeout(() => openaiKeyError.classList.add('hidden'), 3000);
      }
    }

    if (openaiApiKeyInput) {
      openaiApiKeyInput.addEventListener('input', () => {
        if (openaiKeyError) openaiKeyError.classList.add('hidden');
      }, { once: true });
    }

    if (keyValue && !isKeySentinel && !isValidOpenAIKey(keyValue)) {
      showOpenAIKeyError(window.t('error.openaiKey.invalid'));
      return;
    }
    const hasKeyRes = await window.electronAPI.hasOpenAIKey();
    if (!hasKeyRes.has && (!keyValue || isKeySentinel)) {
      showOpenAIKeyError(window.t('error.openaiKey.required'));
      return;
    }
    if (keyValue && !isKeySentinel) {
      const saveRes = await window.electronAPI.saveOpenAIKey(keyValue);
      if (!saveRes.ok) {
        showOpenAIKeyError(saveRes.error || window.t('error.openaiKey.invalid'));
        return;
      }
      if (openaiApiKeyInput) openaiApiKeyInput.value = '';
    }

    const model = openaiModelSelect ? openaiModelSelect.value : 'gpt-4o-mini';
    await window.electronAPI.saveConfig({ openaiModel: model });
    showToastSaved();
    // checkApiKeyBanner will enable the toggle now that a key is saved
    await checkApiKeyBanner();
  });
}

// ── Save Anthropic settings ───────────────────────────────────────
const saveAnthropicCfgBtn = document.getElementById('anthropicai-save-config');

if (saveAnthropicCfgBtn) {
  saveAnthropicCfgBtn.addEventListener('click', async () => {
    const keyValue      = anthropicaiApiKeyInput ? anthropicaiApiKeyInput.value.trim() : '';
    const isKeySentinel = keyValue === MASKED_ANTHROPIC_KEY;

    function isValidAnthropicKey(k) {
      return /^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(k);
    }

    function showAnthropicKeyError(msg) {
      if (anthropicaiApiKeyInput) {
        anthropicaiApiKeyInput.focus();
        anthropicaiApiKeyInput.classList.add('ring-2', 'ring-red-500', 'border-red-400');
        setTimeout(() => anthropicaiApiKeyInput.classList.remove('ring-2', 'ring-red-500', 'border-red-400'), 3000);
      }
      if (anthropicKeyError) {
        anthropicKeyError.textContent = msg;
        anthropicKeyError.classList.remove('hidden');
        setTimeout(() => anthropicKeyError.classList.add('hidden'), 3000);
      }
    }

    if (anthropicaiApiKeyInput) {
      anthropicaiApiKeyInput.addEventListener('input', () => {
        if (anthropicKeyError) anthropicKeyError.classList.add('hidden');
      }, { once: true });
    }

    if (keyValue && !isKeySentinel && !isValidAnthropicKey(keyValue)) {
      showAnthropicKeyError(window.t('error.anthropicKey.invalid'));
      return;
    }
    const hasKeyRes = await window.electronAPI.hasAnthropicKey();
    if (!hasKeyRes.has && (!keyValue || isKeySentinel)) {
      showAnthropicKeyError(window.t('error.anthropicKey.required'));
      return;
    }
    if (keyValue && !isKeySentinel) {
      const saveRes = await window.electronAPI.saveAnthropicKey(keyValue);
      if (!saveRes.ok) {
        showAnthropicKeyError(saveRes.error || window.t('error.anthropicKey.invalid'));
        return;
      }
      if (anthropicaiApiKeyInput) anthropicaiApiKeyInput.value = '';
    }

    const model = anthropicModelSelect ? anthropicModelSelect.value : 'claude-sonnet-4-6';
    await window.electronAPI.saveConfig({ anthropicModel: model });
    showToastSaved();
    await checkApiKeyBanner();
  });
}

if (promptTemplateInput) {
  promptTemplateInput.addEventListener('blur', async () => {
    const cfg = {};
    if (promptTemplateInput.value) cfg.sourceAIPrompt = promptTemplateInput.value;
    const model = getActiveModel();
    if (model) cfg.sourceAIModel = model;
    await window.electronAPI.saveConfig(cfg);
  });
}


// Auto-load config on start
(async () => {
  _populateSettingsSelects();
  const res = await window.electronAPI.loadConfig();
  if (res.ok) {
    const cfg = res.config || {};
    if (promptTemplateInput) promptTemplateInput.value = cfg.sourceAIPrompt || DEFAULT_PROMPT();
    // Restore Gemini page select independently (never corrupted by OpenAI models)
    if (modelSelect) {
      const savedGeminiModel = (_aiModels.gemini.some(m => m.value === cfg.sourceAIModel) ? cfg.sourceAIModel : null)
        || (_aiModels.gemini[0]?.value || 'gemini-3.6-flash');
      modelSelect.value = savedGeminiModel;
      if (!modelSelect.value) modelSelect.selectedIndex = 0;
    }
    // Restore OpenCode Go page select
    if (opencodegoModelSelect && cfg.opencodegoModel) {
      if (_aiModels.opencodego.some(m => m.value === cfg.opencodegoModel)) opencodegoModelSelect.value = cfg.opencodegoModel;
    }
    // Restore OpenAI page select
    if (openaiModelSelect && cfg.openaiModel) {
      const isValidOpenAIModel = _aiModels.openai.some(m => m.value === cfg.openaiModel);
      if (isValidOpenAIModel) openaiModelSelect.value = cfg.openaiModel;
    }
    // Restore Anthropic page select
    if (anthropicModelSelect && cfg.anthropicModel) {
      const isValidAnthropicModel = _aiModels.anthropic.some(m => m.value === cfg.anthropicModel);
      if (isValidAnthropicModel) anthropicModelSelect.value = cfg.anthropicModel;
    }
    applyActiveAiSource(cfg.activeAiSource || 'gemini', false);
    // After applying active source, restore saved model for Home select
    if (cfg.sourceAIModel) {
      const source = cfg.activeAiSource || 'gemini';
      const validForSource = _aiModels[source]?.some(m => m.value === cfg.sourceAIModel);
      if (validForSource && modelSelectHome) modelSelectHome.value = cfg.sourceAIModel;
      // Sincronizar novos selects com o valor restaurado
      if (modelSelectHome?.value) {
        if (modelSelectTranscriptions) modelSelectTranscriptions.value = modelSelectHome.value;
      }
    }
    // Restore theme from config (more reliable than localStorage on some systems)
    if (cfg.theme) applyTheme(cfg.theme === 'dark');
  } else {
    if (promptTemplateInput) promptTemplateInput.value = DEFAULT_PROMPT();
    applyActiveAiSource('gemini', false);
  }
  await checkApiKeyBanner();
})();

// ── Theme toggle ──────────────────────────────────────────────────
const themeToggle = document.getElementById('themeToggle');
const iconSun = document.getElementById('iconSun');
const iconMoon = document.getElementById('iconMoon');
const themeLabel = document.getElementById('themeLabel');

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  if (iconSun) iconSun.classList.toggle('hidden', !dark);
  if (iconMoon) iconMoon.classList.toggle('hidden', dark);
  if (themeLabel) themeLabel.textContent = dark ? window.t('sidebar.theme.light') : window.t('sidebar.theme.dark');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  // Also persist in Electron config so theme survives app restarts reliably
  window.electronAPI.saveConfig({ theme: dark ? 'dark' : 'light' }).catch(() => {});
}

// Sync button state with current theme (set by early-init script in <head>)
applyTheme(document.documentElement.classList.contains('dark'));

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    applyTheme(!document.documentElement.classList.contains('dark'));
  });
}

// ── Transcription (Whisper via main-process IPC) ─────────────────
const startTranscriptionBtn = document.getElementById('startTranscriptionBtn');
const stopTranscriptionBtn  = document.getElementById('stopTranscriptionBtn');
const transcriptLog         = document.getElementById('transcriptLog');
const transcriptPartial     = document.getElementById('transcriptPartial');
const transcriptStatus      = document.getElementById('transcriptStatus');
const clearTranscriptBtn    = document.getElementById('clearTranscriptBtn');
const transcriptSendAiBtn   = document.getElementById('transcriptSendAiBtn');
const transcriptAiPanel       = document.getElementById('transcriptAiPanel');
const transcriptAiPanelHeader = document.getElementById('transcriptAiPanelHeader');
const transcriptAiBtns        = document.getElementById('transcriptAiBtns');
const transcriptSendAiDetailedBtn = document.getElementById('transcriptSendAiDetailedBtn');
const transcriptSendAiAgendaBtn   = document.getElementById('transcriptSendAiAgendaBtn');
const transcriptAiCopyBtn     = document.getElementById('transcriptAiCopyBtn');
const transcriptSaveBtn       = document.getElementById('transcriptSaveBtn');

// ── engine state ─────────────────────────────────────────────────
let _transAudioCtx    = null;
let _transProcessor   = null;
let _transStream      = null;
let _transActive      = false;
let _audioBuffer      = [];    // Float32 samples @ 16kHz
let _flushInProgress  = false;
let _progressCleanup  = null;
let _transTimerInterval = null;
let _transSeconds        = 0;
let _lastRecordedSeconds = 0;    // preserved after stopTransTimer zeroes _transSeconds
let _currentSessionHash  = null; // unique hash per recording session
let _lastSummaryType     = null; // 'short' | 'detailed'
let _activeAiSource      = null; // resolved at save time

// ── system audio capture state ────────────────────────────────────
let _sysAudioCtx       = null;
let _sysProcessor      = null;
let _sysStream         = null;
let _sysBuffer         = [];
let _sysFlushInProgress = false;
let _sysCaptureActive  = false;

// Expose active state so the nav guard (inline script) can check it
window.isTranscribing = () => _transActive;

const CHUNK_SECONDS = 10;  // longer context = fewer hallucinations
const SAMPLE_RATE   = 16000;
const CHUNK_SAMPLES = CHUNK_SECONDS * SAMPLE_RATE;

// Timer helpers for transcription button
const _transStartLabel = document.getElementById('transStartLabel');
const _transTimerLabel = document.getElementById('transTimerLabel');
const _transElapsedLabel = document.getElementById('transElapsedLabel');

function startTransTimer() {
  _transSeconds = 0;
  if (_transStartLabel) _transStartLabel.classList.add('hidden');
  if (_transTimerLabel) { _transTimerLabel.textContent = formatTime(0); _transTimerLabel.classList.remove('hidden'); }
  if (_transElapsedLabel) _transElapsedLabel.classList.add('hidden');
  _transTimerInterval = setInterval(() => {
    _transSeconds++;
    if (_transTimerLabel) _transTimerLabel.textContent = formatTime(_transSeconds);
  }, 1000);
}

function stopTransTimer() {
  clearInterval(_transTimerInterval);
  _transTimerInterval = null;
  const elapsed = formatTime(_transSeconds);
  if (_transStartLabel) _transStartLabel.classList.remove('hidden');
  if (_transTimerLabel) _transTimerLabel.classList.add('hidden');
  if (_transElapsedLabel) {
    _transElapsedLabel.textContent = `| ${window.t('transcriptions.elapsed')} ${elapsed}`;
    _transElapsedLabel.classList.remove('hidden');
  }
  _lastRecordedSeconds = _transSeconds; // preserve before reset so Save can use it
  _transSeconds = 0;
}

function setTranscriptStatus(msg, type) {
  if (!transcriptStatus) return;
  transcriptStatus.textContent = msg;
  const base = 'text-xs font-medium px-2 py-0.5 rounded-full';
  const colour =
    type === 'error'     ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' :
    type === 'loading'   ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
    type === 'active'    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
    type === 'processing'? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' :
                           'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';
  transcriptStatus.className = `${base} ${colour}`;
}

// Speaker colour palette — cycles through colours for SPEAKER_0..N
const SPEAKER_COLOURS = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-violet-100  text-violet-700  dark:bg-violet-900/40  dark:text-violet-300',
  'bg-amber-100   text-amber-700   dark:bg-amber-900/40   dark:text-amber-300',
  'bg-rose-100    text-rose-700    dark:bg-rose-900/40    dark:text-rose-300',
  'bg-cyan-100    text-cyan-700    dark:bg-cyan-900/40    dark:text-cyan-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
];
const SYSTEM_COLOUR = 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';

function speakerColour(speakerLabel) {
  const idx = parseInt((speakerLabel || '').replace(/\D/g, '') || '0', 10);
  return SPEAKER_COLOURS[idx % SPEAKER_COLOURS.length];
}

// Remove frases idênticas repetidas 3+ vezes consecutivamente (alucinação de loop do Whisper).
function _dedupeHallucination(text) {
  if (!text || text.length < 20) return text;
  const segs = text.split(/(?<=[.!?])\s+|-(?=\S)/g).map(s => s.trim()).filter(Boolean);
  if (segs.length < 4) return text;
  const out = [];
  let i = 0;
  while (i < segs.length) {
    out.push(segs[i]);
    const norm = segs[i].toLowerCase();
    let j = i + 1;
    while (j < segs.length && segs[j].toLowerCase() === norm) j++;
    i = (j - i >= 3) ? j : i + 1;
  }
  return out.join(' ').trim();
}

// source: 'mic' | 'system'
// speaker: null (no label) | 'SPEAKER_0' | 'SPEAKER_1' | etc.
function appendTranscriptLine(text, source = 'mic', speaker = null) {
  if (!text || !transcriptLog) return;
  const line = document.createElement('p');
  line.className = 'py-1 border-b border-zinc-100 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200';

  // Determine label text and colour
  let labelText  = null;
  let labelClass = '';

  if (source === 'system') {
    // Remote participant: show SPEAKER_N if diarized, otherwise generic "Vídeo"
    labelText  = speaker || window.t('transcriptions.speaker.system');
    labelClass = speaker ? speakerColour(speaker) : SYSTEM_COLOUR;
  } else if (speaker) {
    // In-room multi-speaker (mic-only, no system capture)
    labelText  = speaker;
    labelClass = speakerColour(speaker);
  } else if (_sysCaptureActive) {
    // Local user when system audio is also active
    labelText  = window.t('transcriptions.speaker.mic');
    labelClass = speakerColour('0');
  }

  if (labelText) {
    const tag = document.createElement('span');
    tag.className = `inline-block mr-2 text-xs font-semibold px-1.5 py-0.5 rounded ${labelClass}`;
    tag.textContent = labelText;
    line.appendChild(tag);
    line.appendChild(document.createTextNode(text));
  } else {
    line.textContent = text;
  }
  transcriptLog.appendChild(line);
  transcriptLog.scrollTop = transcriptLog.scrollHeight;
}

async function flushAudioBuffer() {
  if (_audioBuffer.length === 0 || _flushInProgress) return;

  // Silence detection: skip chunks that are mostly quiet (RMS < threshold)
  const rms = Math.sqrt(
    _audioBuffer.reduce((s, v) => s + v * v, 0) / _audioBuffer.length
  );
  if (rms < 0.008) {
    _audioBuffer = [];
    return;
  }

  _flushInProgress = true;
  try {
    const float32 = new Float32Array(_audioBuffer);
    _audioBuffer = [];
    if (_transActive) {
      if (transcriptPartial) transcriptPartial.textContent = window.t('transcriptions.status.processing') + '…';
      setTranscriptStatus(window.t('transcriptions.status.processing'), 'processing');
    }

    // When system audio is also captured, mic = always the local user (no need to diarize).
    // When mic-only (e.g. two people sharing the same physical mic), diarize to split speakers.
    const chunkId = crypto.randomUUID();
    const tasks = [window.electronAPI.whisperTranscribe(float32, window.getCurrentLang())];
    if (!_sysCaptureActive) tasks.push(window.electronAPI.diarizeChunk(float32, chunkId));

    const [res, diarRes] = await Promise.all(tasks);

    if (transcriptPartial) transcriptPartial.textContent = '';
    if (res.ok) {
      const cleanText = _dedupeHallucination(res.text);
      if (cleanText) {
        if (_sysCaptureActive) {
          // System audio active → mic is always the local user
          appendTranscriptLine(cleanText, 'mic', null);
        } else {
          // Mic-only mode → use diarization to split in-room speakers
          const speaker = diarRes?.ok && diarRes.speakers?.length > 0
            ? diarRes.speakers.reduce((a, b) => (b.end - b.start) > (a.end - a.start) ? b : a).label
            : null;
          appendTranscriptLine(cleanText, 'mic', speaker);
        }
      }
      if (_transActive) setTranscriptStatus(window.t('transcriptions.status.active'), 'active');
    } else {
      console.error('whisperTranscribe error:', res.error);
      if (_transActive) setTranscriptStatus(window.t('transcriptions.status.error') + ': ' + res.error, 'error');
    }
  } catch (err) {
    console.error('flushAudioBuffer error', err);
    if (_transActive) setTranscriptStatus(window.t('transcriptions.status.error') + ': ' + err.message, 'error');
  } finally {
    _flushInProgress = false;
  }
}

async function startTranscription() {
  if (_transActive) return;
  // generate a new unique session hash for deduplication
  _currentSessionHash = crypto.randomUUID();
  _lastSummaryType    = null;

  // getDisplayMedia() requires transient activation (user gesture) — must be
  // called synchronously from this click handler, before any await consumes
  // the gesture. Kicked off here (Windows/macOS only) and consumed later in
  // tryStartSystemAudio(). Silent fallback (null) if it fails/unsupported.
  let _sysDisplayMediaPromise = null;
  if (_detectPlatform() !== 'linux') {
    _sysDisplayMediaPromise = navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      .catch((err) => {
        console.warn('[sys-audio] getDisplayMedia falhou ao iniciar:', err.name, err.message);
        return null;
      });
  }

  // Reset speaker registry so each session starts fresh (SPEAKER_0 = first person to speak)
  window.electronAPI.diarizationReset().catch(() => {});
  if (transcriptSaveBtn) { transcriptSaveBtn.disabled = true; }
  if (startTranscriptionBtn) startTranscriptionBtn.disabled = true;
  // Hide AI buttons container and reset AI panel at the start of a new session
  if (transcriptAiBtns) transcriptAiBtns.classList.add('hidden');
  if (transcriptAiPanel) transcriptAiPanel.classList.add('hidden');
  if (transcriptAiPanelHeader) transcriptAiPanelHeader.classList.add('hidden');
  if (transcriptAiPanel) transcriptAiPanel.textContent = '';
  if (transcriptAiCopyBtn) transcriptAiCopyBtn.disabled = true;
  _progressCleanup = window.electronAPI.onWhisperProgress((data) => {
    if (data.status === 'downloading') {
      setTranscriptStatus(
        `${window.t('transcriptions.status.loading')} ${data.file} ${data.progress}%`,
        'loading'
      );
    } else {
      setTranscriptStatus(window.t('transcriptions.status.loading'), 'loading');
    }
  });

  setTranscriptStatus(window.t('transcriptions.status.loading'), 'loading');

  // Kick off model load in background (non-blocking)
  window.electronAPI.whisperLoad().then((res) => {
    if (!res.ok) {
      setTranscriptStatus(window.t('transcriptions.status.error') + ': ' + res.error, 'error');
      return;
    }
    if (res.loadTimeMs != null) {
      const secs = (res.loadTimeMs / 1000).toFixed(1);
      setTranscriptStatus(
        `${window.t('transcriptions.status.loading')} \u2714 ${secs}s`,
        'loading'
      );
      setTimeout(() => {
        if (_transActive) setTranscriptStatus(window.t('transcriptions.status.active'), 'active');
      }, 3000);
    } else {
      if (_transActive) setTranscriptStatus(window.t('transcriptions.status.active'), 'active');
    }
  });

  try {
    try {
      _transStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: { ideal: SAMPLE_RATE }, channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: false,
      });
    } catch (err) {
      if (err.name === 'NotReadableError') {
        console.warn('[mic] getUserMedia com constraints completos falhou (NotReadableError) — tentando fallback audio:true', err.message);
        try {
          _transStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          console.log('[mic] fallback audio:true OK');
        } catch (err2) {
          if (err2.name === 'NotReadableError') {
            console.warn('[mic] fallback audio:true também falhou (NotReadableError) — tentando deviceId "communications"', err2.message);
            _transStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: 'communications' } }, video: false });
            console.log('[mic] fallback deviceId "communications" OK');
          } else {
            throw err2;
          }
        }
      } else {
        throw err;
      }
    }

    _transAudioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = _transAudioCtx.createMediaStreamSource(_transStream);
    _transProcessor = _transAudioCtx.createScriptProcessor(4096, 1, 1);

    _transProcessor.onaudioprocess = (evt) => {
      if (!_transActive) return;
      const samples = evt.inputBuffer.getChannelData(0);
      _audioBuffer.push(...samples);
      if (_audioBuffer.length >= CHUNK_SAMPLES) flushAudioBuffer();
    };

    source.connect(_transProcessor);
    _transProcessor.connect(_transAudioCtx.destination);
    _transActive = true;
    if (stopTranscriptionBtn) stopTranscriptionBtn.disabled = false;
    startTransTimer();

    // Best-effort: attach to PulseAudio/PipeWire monitor for system audio.
    // Mic permission was just granted, so enumerateDevices returns labels now.
    // Silent fallback to mic-only if no monitor device found.
    tryStartSystemAudio(_sysDisplayMediaPromise);

  } catch (err) {
    console.error('startTranscription error', err);
    if (err.name === 'NotAllowedError') {
      setTranscriptStatus(
        window.t('log.audio.permissionDenied.title') + ' ' + window.t('log.audio.permissionDenied.' + _detectPlatform()),
        'error'
      );
    } else if (err.name === 'NotReadableError') {
      let deviceInfo = 'audioinput devices: erro ao listar';
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        deviceInfo = `audioinput devices: ${audioInputs.length}`;
      } catch (_) {}
      setTranscriptStatus(
        window.t('log.audio.deviceError.title') + ' ' + window.t('log.audio.deviceError.' + _detectPlatform()) +
          ` (${err.name}: ${err.message} — ${deviceInfo})`,
        'error'
      );
    } else {
      setTranscriptStatus(window.t('transcriptions.status.error') + ': ' + err.message, 'error');
    }
    if (startTranscriptionBtn) startTranscriptionBtn.disabled = false;
    _transActive = false;
    if (_progressCleanup) { _progressCleanup(); _progressCleanup = null; }
  }
}

async function stopTranscription() {
  _transActive = false;
  stopTransTimer();
  if (_progressCleanup) { _progressCleanup(); _progressCleanup = null; }

  // Show loading state on the Stop button while flushing the last audio chunk
  if (stopTranscriptionBtn) {
    stopTranscriptionBtn.disabled = true;
    const spanEl = stopTranscriptionBtn.querySelector('span[data-i18n]');
    const svgEl  = stopTranscriptionBtn.querySelector('svg');
    if (spanEl) spanEl.textContent = window.t('btn.stopTranscription.loading');
    // Replace stop icon with a simple spinner
    if (svgEl) svgEl.outerHTML = `<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg>`;
  }

  // Yield to the browser paint pipeline so "Aguarde…" actually renders
  // BEFORE any heavy IPC / Whisper inference work starts.
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

  // 1. Stop audio capture first to prevent samples from accumulating further.
  if (_transProcessor) { _transProcessor.disconnect(); _transProcessor = null; }
  if (_transAudioCtx)  { _transAudioCtx.close().catch(() => {}); _transAudioCtx = null; }
  if (_transStream)    { _transStream.getTracks().forEach(t => t.stop()); _transStream = null; }
  await stopSystemCapture();

  // 2. Wait for any in-flight Whisper call to finish, then flush the remaining buffer.
  while (_flushInProgress) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await flushAudioBuffer(); // process the last partial buffer (if any)

  if (transcriptPartial) transcriptPartial.textContent = '';
  setTranscriptStatus(window.t('transcriptions.status.idle'), 'idle');
  if (startTranscriptionBtn) startTranscriptionBtn.disabled = false;

  // Restore Stop button to its original state
  if (stopTranscriptionBtn) {
    stopTranscriptionBtn.disabled = true; // disabled when not recording
    const spanEl = stopTranscriptionBtn.querySelector('span[data-i18n]');
    const spinnerEl = stopTranscriptionBtn.querySelector('svg');
    if (spanEl) spanEl.textContent = window.t('btn.stopTranscription');
    if (spinnerEl) spinnerEl.outerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`;
  }

  // Show AI buttons if there's transcribed text
  if (transcriptAiBtns && transcriptLog && transcriptLog.textContent.trim()) {
    transcriptAiBtns.classList.remove('hidden');
  }
}

// ── System audio capture ──────────────────────────────────────────

async function flushSystemBuffer() {
  if (_sysBuffer.length === 0 || _sysFlushInProgress) return;
  const rms = Math.sqrt(_sysBuffer.reduce((s, v) => s + v * v, 0) / _sysBuffer.length);
  console.log(`[sys-audio] flush rms=${rms.toFixed(5)} samples=${_sysBuffer.length}`);
  if (rms < 0.008) { _sysBuffer = []; return; }
  _sysFlushInProgress = true;
  try {
    const float32 = new Float32Array(_sysBuffer);
    _sysBuffer = [];
    const chunkId = crypto.randomUUID();
    // Diarize system audio to distinguish multiple remote speakers (SPEAKER_0, SPEAKER_1...)
    const [res, diarRes] = await Promise.all([
      window.electronAPI.whisperTranscribe(float32, window.getCurrentLang()),
      window.electronAPI.diarizeChunk(float32, chunkId),
    ]);
    const cleanSysText = _dedupeHallucination(res.ok ? res.text : '');
    if (cleanSysText) {
      const speaker = diarRes?.ok && diarRes.speakers?.length > 0
        ? diarRes.speakers.reduce((a, b) => (b.end - b.start) > (a.end - a.start) ? b : a).label
        : null;
      appendTranscriptLine(cleanSysText, 'system', speaker);
    }
  } catch (err) {
    console.error('flushSystemBuffer error', err);
  } finally {
    _sysFlushInProgress = false;
  }
}

// Wires an already-acquired MediaStream (system audio) into the existing
// AudioContext/ScriptProcessor pipeline used for chunked transcription.
// Shared by the PulseAudio "monitor" path and the getDisplayMedia loopback fallback.
function _wireSystemAudioStream(stream) {
  _sysAudioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const sysSource = _sysAudioCtx.createMediaStreamSource(stream);
  _sysProcessor  = _sysAudioCtx.createScriptProcessor(4096, 1, 1);

  _sysProcessor.onaudioprocess = (evt) => {
    if (!_sysCaptureActive) return;
    const samples = evt.inputBuffer.getChannelData(0);
    _sysBuffer.push(...samples);
    if (_sysBuffer.length >= CHUNK_SAMPLES) flushSystemBuffer();
  };

  sysSource.connect(_sysProcessor);
  _sysProcessor.connect(_sysAudioCtx.destination);
  _sysCaptureActive = true;

  stream.getAudioTracks()[0].addEventListener('ended', () => stopSystemCapture());
}

// Silently tries to attach to a PulseAudio/PipeWire monitor device.
// Falls back gracefully — mic-only mode if no monitor found (Linux),
// or consumes the getDisplayMedia loopback stream pre-started in
// startTranscription() (Windows/macOS) — getDisplayMedia() requires
// transient activation (user gesture), so it can't be called from here
// directly: by this point the click's activation has likely expired.
async function tryStartSystemAudio(displayMediaPromise) {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    console.log('[sys-audio] audioinput devices:', audioInputs.map(d => ({
      label: d.label || '(sem label)',
      deviceId: d.deviceId.slice(0, 12) + '…',
    })));

    const monitor = devices.find(d =>
      d.kind === 'audioinput' &&
      d.label.toLowerCase().includes('monitor')
    );

    if (!monitor) {
      if (_detectPlatform() === 'linux') {
        console.warn('[sys-audio] nenhum dispositivo "monitor" encontrado — system audio NÃO será capturado');
        return;
      }

      if (!displayMediaPromise) {
        console.warn('[sys-audio] getDisplayMedia não foi iniciado — system audio NÃO será capturado');
        return;
      }

      console.log('[sys-audio] usando loopback via getDisplayMedia (' + _detectPlatform() + ')');
      _sysStream = await displayMediaPromise;
      if (!_sysStream) {
        console.warn('[sys-audio] getDisplayMedia indisponível — system audio NÃO será capturado');
        return;
      }

      // Descartamos o vídeo imediatamente — queremos só o áudio do sistema
      _sysStream.getVideoTracks().forEach(t => t.stop());

      const sysTrack = _sysStream.getAudioTracks()[0];
      console.log(`[sys-audio] getDisplayMedia OK — track label="${sysTrack?.label}" readyState=${sysTrack?.readyState}`);

      _wireSystemAudioStream(_sysStream);
      return;
    }

    console.log(`[sys-audio] dispositivo monitor selecionado: "${monitor.label}"`);

    _sysStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: monitor.deviceId }, sampleRate: { ideal: SAMPLE_RATE }, channelCount: 1 },
      video: false,
    });

    const sysTrack = _sysStream.getAudioTracks()[0];
    console.log(`[sys-audio] getUserMedia OK — track label="${sysTrack?.label}" readyState=${sysTrack?.readyState}`);

    _wireSystemAudioStream(_sysStream);

    // O monitor PulseAudio foi usado — descarta o stream getDisplayMedia
    // pré-iniciado (se houver) para não deixar captura de tela pendurada.
    if (displayMediaPromise) {
      displayMediaPromise.then((s) => s?.getTracks().forEach(t => t.stop())).catch(() => {});
    }
  } catch (err) {
    console.error('[sys-audio] tryStartSystemAudio falhou:', err.name, err.message);
    _sysCaptureActive = false;
    if (_sysStream) { _sysStream.getTracks().forEach(t => t.stop()); _sysStream = null; }
  }
}

async function stopSystemCapture() {
  if (!_sysCaptureActive && !_sysStream) return;
  _sysCaptureActive = false;
  if (_sysProcessor) { _sysProcessor.disconnect(); _sysProcessor = null; }
  if (_sysAudioCtx)  { _sysAudioCtx.close().catch(() => {}); _sysAudioCtx = null; }
  if (_sysStream)    { _sysStream.getTracks().forEach(t => t.stop()); _sysStream = null; }
  while (_sysFlushInProgress) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (_sysBuffer.length > 0) await flushSystemBuffer();
  _sysBuffer = [];
}

if (startTranscriptionBtn) startTranscriptionBtn.addEventListener('click', startTranscription);
if (stopTranscriptionBtn)  stopTranscriptionBtn.addEventListener('click', stopTranscription);
// Limpar Transcrições — função extraída para reutilização
function _clearTranscriptions() {
  if (transcriptLog)          transcriptLog.innerHTML = '';
  if (transcriptPartial)      transcriptPartial.textContent = '';
  if (transcriptAiBtns)       transcriptAiBtns.classList.add('hidden');
  if (transcriptAiPanel)      transcriptAiPanel.classList.add('hidden');
  if (transcriptAiPanelHeader) transcriptAiPanelHeader.classList.add('hidden');
  if (transcriptAiPanel)      transcriptAiPanel.textContent = '';
  if (transcriptAiCopyBtn)    transcriptAiCopyBtn.disabled = true;
  if (transcriptSaveBtn)      transcriptSaveBtn.disabled = true;
  _currentSessionHash = null;
  _lastSummaryType    = null;
}

if (clearTranscriptBtn) {
  clearTranscriptBtn.addEventListener('click', () => {
    _clearTranscriptions();
  });
}

// Helper to send transcript to AI and show result in panel
async function sendTranscriptToAI(promptKey, btn, summaryType) {
  if (!transcriptLog || !transcriptLog.textContent.trim()) return;
  const text = Array.from(transcriptLog.querySelectorAll('p'))
    .map(p => p.textContent.trim())
    .filter(Boolean)
    .join(' ');
  const prompt = window.t(promptKey);
  const labelEl = btn.querySelector('span[data-i18n]');
  const originalLabel = labelEl ? labelEl.textContent : '';
  btn.disabled = true;
  if (transcriptAiCopyBtn) transcriptAiCopyBtn.disabled = true;
  if (transcriptSaveBtn)   transcriptSaveBtn.disabled = true;
  if (labelEl) labelEl.textContent = window.t('btn.sendAi.loading');
  if (transcriptAiPanel) transcriptAiPanel.classList.remove('hidden');
  if (transcriptAiPanelHeader) transcriptAiPanelHeader.classList.remove('hidden');
  if (transcriptAiPanel) transcriptAiPanel.textContent = window.t('btn.sendAi.loading');
  try {
    const selectedModel = modelSelectTranscriptions?.value || modelSelectHome?.value;
    const payload = { text, prompt };
    if (selectedModel) payload.model = selectedModel;
    const res = await window.electronAPI.sendText(payload);
    const aiText = res.ok
      ? (extractAiText(res) || JSON.stringify(res.result))
      : (res.error ? window.t('error.prefix') + res.error : JSON.stringify(res.result));
    if (transcriptAiPanel) transcriptAiPanel.textContent = aiText;
    _lastSummaryType = summaryType;
  } catch (err) {
    if (transcriptAiPanel) transcriptAiPanel.textContent = window.t('error.prefix') + err.message;
  } finally {
    btn.disabled = false;
    if (labelEl) labelEl.textContent = originalLabel;
    const hasContent = !!(transcriptAiPanel?.textContent.trim());
    if (transcriptAiCopyBtn) transcriptAiCopyBtn.disabled = !hasContent;
    if (transcriptSaveBtn)   transcriptSaveBtn.disabled   = !hasContent || !_currentSessionHash;
  }
}

if (transcriptSendAiBtn) {
  transcriptSendAiBtn.addEventListener('click', () =>
    sendTranscriptToAI('transcriptions.aiPrompt', transcriptSendAiBtn, 'short')
  );
}

if (transcriptSendAiDetailedBtn) {
  transcriptSendAiDetailedBtn.addEventListener('click', () =>
    sendTranscriptToAI('transcriptions.aiPromptDetailed', transcriptSendAiDetailedBtn, 'detailed')
  );
}

if (transcriptSendAiAgendaBtn) {
  transcriptSendAiAgendaBtn.addEventListener('click', () =>
    sendTranscriptToAI('transcriptions.aiPromptAgenda', transcriptSendAiAgendaBtn, 'agenda')
  );
}

if (transcriptAiCopyBtn) {
  transcriptAiCopyBtn.addEventListener('click', async () => {
    const text = transcriptAiPanel ? transcriptAiPanel.textContent.trim() : '';
    if (!text) return;
    const labelEl = transcriptAiCopyBtn.querySelector('span[data-i18n]');
    try {
      await navigator.clipboard.writeText(text);
      if (labelEl) {
        labelEl.textContent = window.t('btn.copy.done');
        setTimeout(() => { labelEl.textContent = window.t('btn.copy'); }, 2000);
      }
    } catch {
      // clipboard unavailable — silently ignore
    }
  });
}

// ── Home AI Response copy button ───────────────────────────────────
if (aiResponseCopyBtn && aiResponseEl) {
  // Keep button state in sync with content
  new MutationObserver(() => {
    aiResponseCopyBtn.disabled = !aiResponseEl.textContent.trim();
  }).observe(aiResponseEl, { childList: true, characterData: true, subtree: true });

  aiResponseCopyBtn.addEventListener('click', async () => {
    const text = aiResponseEl.textContent.trim();
    if (!text) return;
    const labelEl = aiResponseCopyBtn.querySelector('span[data-i18n]');
    try {
      await navigator.clipboard.writeText(text);
      if (labelEl) {
        labelEl.textContent = window.t('btn.copy.done');
        setTimeout(() => { labelEl.textContent = window.t('btn.copy'); }, 2000);
      }
    } catch {
      // clipboard unavailable — silently ignore
    }
  });
}

// ── Home captured-text copy button ─────────────────────────────────
if (copyHomeBtn && logEl) {
  new MutationObserver(() => {
    copyHomeBtn.disabled = !logEl.textContent.trim();
  }).observe(logEl, { childList: true, characterData: true, subtree: true });

  copyHomeBtn.addEventListener('click', async () => {
    const text = logEl.textContent.trim();
    if (!text) return;
    const labelEl = copyHomeBtn.querySelector('span[data-i18n]');
    try {
      await navigator.clipboard.writeText(text);
      if (labelEl) {
        labelEl.textContent = window.t('btn.copy.done');
        setTimeout(() => { labelEl.textContent = window.t('btn.copy'); }, 2000);
      }
    } catch {
      // clipboard unavailable — silently ignore
    }
  });
}

setTranscriptStatus(window.t('transcriptions.status.idle'), 'idle');

// ── Save transcription ────────────────────────────────────────────
if (transcriptSaveBtn) {
  transcriptSaveBtn.addEventListener('click', async () => {
    if (!_currentSessionHash) return;
    const aiSummary    = transcriptAiPanel ? transcriptAiPanel.textContent.trim() : '';
    const transcriptText = transcriptLog
      ? Array.from(transcriptLog.querySelectorAll('p')).map(p => p.textContent.trim()).filter(Boolean).join('\n')
      : '';
    if (!aiSummary) return;

    const cfgRes = await window.electronAPI.loadConfig().catch(() => ({}));
    const cfg = cfgRes.config || cfgRes;
    const aiProvider = cfg.activeAiSource || 'gemini';
    const aiModel    = cfg.sourceAIModel  || cfg.openaiModel || cfg.anthropicModel || cfg.opencodegoModel || '';
    const lang       = window.getCurrentLang ? window.getCurrentLang() : 'en';

    const data = {
      session_hash:     _currentSessionHash,
      meeting_type:     2,
      summary_type:     _lastSummaryType,
      transcript_text:  transcriptText,
      ai_summary:       aiSummary,
      prompt_used:      window.t(_lastSummaryType === 'detailed' ? 'transcriptions.aiPromptDetailed' : 'transcriptions.aiPrompt'),
      recorded_seconds: _lastRecordedSeconds,
      ai_provider:      aiProvider,
      ai_model:         aiModel,
      language:         lang,
    };

    const labelEl = transcriptSaveBtn.querySelector('span[data-i18n]');
    const originalLabel = labelEl ? labelEl.textContent : '';
    transcriptSaveBtn.disabled = true;
    if (labelEl) labelEl.textContent = '…';

    try {
      const res = await window.electronAPI.saveTranscription(data);
      if (res.ok) {
        if (labelEl) labelEl.textContent = '✓';
        setTimeout(() => {
          if (labelEl) labelEl.textContent = originalLabel;
          transcriptSaveBtn.disabled = false;
        }, 2000);
      } else {
        if (labelEl) labelEl.textContent = originalLabel;
        transcriptSaveBtn.disabled = false;
        console.error('[save transcription] error', res.error);
      }
    } catch (err) {
      if (labelEl) labelEl.textContent = originalLabel;
      transcriptSaveBtn.disabled = false;
      console.error('[save transcription] exception', err);
    }
  });
}

// ── Reuniões page ─────────────────────────────────────────────────
(function () {
  const searchInput    = document.getElementById('reunionsSearch');
  const tableBody      = document.getElementById('reunionsTableBody');
  const emptyState     = document.getElementById('reunionsEmpty');
  const prevBtn        = document.getElementById('reunionsPrevBtn');
  const nextBtn        = document.getElementById('reunionsNextBtn');
  const pageInfo       = document.getElementById('reunionsPageInfo');

  // Edit modal
  const editModal      = document.getElementById('editModal');
  const editAiSummary  = document.getElementById('editAiSummary');
  const editTranscript = document.getElementById('editTranscript');
  const editModalClose = document.getElementById('editModalClose');
  const editModalCancel= document.getElementById('editModalCancel');
  const editModalSave  = document.getElementById('editModalSave');

  // Delete modal
  const deleteModal    = document.getElementById('deleteModal');
  const deleteModalCancel  = document.getElementById('deleteModalCancel');
  const deleteModalConfirm = document.getElementById('deleteModalConfirm');

  let _page    = 1;
  let _total   = 0;
  let _totalPages = 1;
  let _search  = '';
  let _editId         = null;
  let _deleteId       = null;
  let _searchTimer = null;

  function clearReunionsTable() {
    _page = 1;
    _total = 0;
    _totalPages = 1;
    _search = '';
    if (searchInput) searchInput.value = '';
    if (tableBody) tableBody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    if (pageInfo) pageInfo.textContent = '1 / 1';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
  }

  // Expose globally
  window._clearReunions = clearReunionsTable;

  function formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr.replace(' ', 'T') + 'Z');
      const locale = window.getCurrentLang ? window.getCurrentLang() : 'en';
      const isPtBr = locale === 'pt-BR';
      const datePart = d.toLocaleDateString(locale);
      const timePart = d.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: !isPtBr,
      });
      return `${datePart} ${timePart}`;
    } catch { return isoStr; }
  }

  function formatDuration(secs) {
    if (!secs) return '\u2014';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  async function loadPage() {
    if (!window.electronAPI || !window.electronAPI.listTranscriptions) return;
    const res = await window.electronAPI.listTranscriptions({ page: _page, limit: 15, search: _search }).catch(() => null);
    if (!res || !res.ok) return;
    _total      = res.total;
    _totalPages = res.totalPages;
    renderTable(res.rows);
    updatePagination();
  }

  function renderTable(rows) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const isEmpty = !rows || rows.length === 0;
    if (emptyState) emptyState.classList.toggle('hidden', !isEmpty);
    if (isEmpty) return;

    rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.dataset.rowId = row.id;
      tr.className = 'border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors';
      const preview = (row.ai_summary_preview || '').replace(/\n/g, ' ').slice(0, 100) +
                      ((row.ai_summary_preview || '').length >= 100 ? '\u2026' : '');
      const escapedPreview = (row.ai_summary_preview || '').replace(/"/g, '&quot;');
      const meetingTypeLabel = row.meeting_type === 1
        ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">${window.t('meeting.type.1') || 'A\u00e7\u00f5es R\u00e1pidas'}</span>`
        : row.meeting_type === 3
          ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400">${window.t('meeting.type.3') || 'Tradu\u00e7\u00e3o'}</span>`
          : `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">${window.t('meeting.type.2') || 'Transcri\u00e7\u00f5es'}</span>`;
      tr.innerHTML = `
        <td class="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">${formatDate(row.created_at)}</td>
        <td class="px-4 py-3 whitespace-nowrap">${meetingTypeLabel}</td>
        <td class="px-4 py-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">${row.ai_provider || '\u2014'}</td>
        <td class="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap font-mono">${formatDuration(row.recorded_seconds)}</td>
        <td class="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300 max-w-xs truncate" title="${escapedPreview}">${preview}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <button class="btn-edit text-xs px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 transition mr-1" data-id="${row.id}">&#9999;</button>
          <button class="btn-delete text-xs px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 transition" data-id="${row.id}">&#128465;</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    // Highlights the clicked row and removes highlight from all others
    function selectRow(id) {
      document.querySelectorAll('#reunionsTableBody tr[data-row-id]').forEach(tr => {
        tr.classList.remove(
          'bg-blue-50', 'dark:bg-blue-900/20',
          'ring-1', 'ring-inset', 'ring-blue-200', 'dark:ring-blue-700'
        );
      });
      const tr = document.querySelector(`#reunionsTableBody tr[data-row-id="${id}"]`);
      if (tr) {
        tr.classList.add(
          'bg-blue-50', 'dark:bg-blue-900/20',
          'ring-1', 'ring-inset', 'ring-blue-200', 'dark:ring-blue-700'
        );
      }
    }

    // Wire edit/delete buttons
    tableBody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        selectRow(btn.dataset.id);
        openEditModal(Number(btn.dataset.id));
      });
    });
    tableBody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        selectRow(btn.dataset.id);
        openDeleteModal(Number(btn.dataset.id));
      });
    });
  }

  function updatePagination() {
    if (pageInfo)  pageInfo.textContent  = `${_page} / ${_totalPages}`;
    if (prevBtn)   prevBtn.disabled  = _page <= 1;
    if (nextBtn)   nextBtn.disabled  = _page >= _totalPages;
  }

  async function openEditModal(id) {
    const res = await window.electronAPI.getTranscription(id).catch(() => null);
    if (!res || !res.ok || !res.row) return;
    _editId = id;
    if (editAiSummary)  editAiSummary.value  = res.row.ai_summary       || '';
    if (editTranscript) editTranscript.value = res.row.transcript_text   || '';
    if (editModal) editModal.classList.remove('hidden');
  }

  function closeEditModal() {
    if (editModal) editModal.classList.add('hidden');
    _editId = null;
  }

  function openDeleteModal(id) {
    _deleteId = id;
    if (deleteModal) deleteModal.classList.remove('hidden');
  }

  function closeDeleteModal() {
    if (deleteModal) deleteModal.classList.add('hidden');
    _deleteId = null;
  }

  if (editModalClose)  editModalClose.addEventListener('click',  closeEditModal);
  if (editModalCancel) editModalCancel.addEventListener('click', closeEditModal);
  if (deleteModalCancel) deleteModalCancel.addEventListener('click', closeDeleteModal);

  if (editModalSave) {
    editModalSave.addEventListener('click', async () => {
      if (!_editId) return;
      const data = {
        ai_summary:      editAiSummary  ? editAiSummary.value  : undefined,
        transcript_text: editTranscript ? editTranscript.value : undefined,
      };
      await window.electronAPI.updateTranscription(_editId, data).catch(() => {});
      closeEditModal();
      await loadPage();
    });
  }

  if (deleteModalConfirm) {
    deleteModalConfirm.addEventListener('click', async () => {
      if (!_deleteId) return;
      await window.electronAPI.deleteTranscription(_deleteId).catch(() => {});
      closeDeleteModal();
      if (_page > 1 && _total - 1 <= (_page - 1) * 15) _page--;
      await loadPage();
    });
  }

  if (prevBtn) prevBtn.addEventListener('click', async () => { if (_page > 1) { _page--; await loadPage(); } });
  if (nextBtn) nextBtn.addEventListener('click', async () => { if (_page < _totalPages) { _page++; await loadPage(); } });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(async () => {
        _search = searchInput.value.trim();
        _page = 1;
        await loadPage();
      }, 350);
    });
  }

  // Load when Reuniões nav is clicked
  document.querySelectorAll('[data-nav="reunions"]').forEach(btn => {
    btn.addEventListener('click', () => {
      _page = 1;
      _search = '';
      if (searchInput) searchInput.value = '';
      loadPage();
    });
  });

  // Close modals on backdrop click
  if (editModal) editModal.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });
  if (deleteModal) deleteModal.addEventListener('click', e => { if (e.target === deleteModal) closeDeleteModal(); });
})();

// ── Startup: version label, update banner, window controls ──
(function () {
  // ── Transcription model (Settings) ──────────────────────────────
  const whisperRadios = document.querySelectorAll('input[name="whisperModel"]');
  window.electronAPI.loadConfig().then(res => {
    const saved = (res?.config || res || {}).whisperModel;
    const value = ['fast', 'balanced'].includes(saved) ? saved : 'balanced'; // keep in sync with WHISPER_DEFAULT_PROFILE
    whisperRadios.forEach(r => { r.checked = r.value === value; });
  }).catch(() => {});
  whisperRadios.forEach(r => r.addEventListener('change', () => {
    if (r.checked) window.electronAPI.saveConfig({ whisperModel: r.value });
  }));

  // ── Support link (sidebar + Settings → About) ───────────────────
  ['supportBtn', 'aboutSupportBtn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => window.electronAPI.openSupportUrl());
  });

  // ── Versão do app ────────────────────────────────────────────────
  window.electronAPI.getAppVersion().then(v => {
    const el = document.getElementById('appVersionLabel');
    if (el) el.textContent = `v${v}`;
  });

  // Listener de notificação de versão disponível
  if (window.electronAPI?.onUpdateAvailable) {
    window.electronAPI.onUpdateAvailable(({ latestVersion, downloadUrl }) => {
      const banner = document.getElementById('update-banner');
      const textEl = document.getElementById('update-banner-text');
      const linkEl = document.getElementById('update-banner-link');

      if (!banner || !textEl || !linkEl) return;

      textEl.textContent = window.t('update.banner.text').replace('{version}', latestVersion);
      linkEl.textContent = window.t('update.banner.cta');

      linkEl.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.electronAPI?.shellOpenExternal) {
          window.electronAPI.shellOpenExternal(downloadUrl);
        } else {
          window.open(downloadUrl, '_blank');
        }
      });

      banner.classList.remove('hidden');
    });
  }

  // Controles da janela frameless
  document.getElementById('win-min-btn')?.addEventListener('click', () =>
    window.electronAPI.windowMinimize());
  document.getElementById('win-max-btn')?.addEventListener('click', () =>
    window.electronAPI.windowMaximizeToggle());
  document.getElementById('win-close-btn')?.addEventListener('click', () =>
    window.electronAPI.windowClose());
})();
