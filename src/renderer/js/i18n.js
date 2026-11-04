// ── Internationalization (i18n) ────────────────────────────────
// Supported locales: 'en' (default), 'pt-BR'
(function () {
  var LOCALES = {
    en: {
      // Sidebar
      'nav.section':           'Navigation',
      'nav.home':              'Home',
      'nav.aiSources':         'AI Sources',
      'nav.settings':          'Settings',
      'sidebar.theme':         'Theme',
      'sidebar.theme.dark':    'Dark',
      'sidebar.theme.light':   'Light',
      'sidebar.hide':          'Hide now',
      'sidebar.support':       'Buy me a coffee',
      'settings.whisper.title':    'Transcription model',
      'settings.whisper.desc':     'Local Whisper model used on the Transcriptions page. Applied the next time you press Start.',
      'settings.whisper.fast':     'Fast',
      'settings.whisper.fast.desc': 'Lightest. Good for English and clean audio.',
      'settings.whisper.balanced': 'Balanced',
      'settings.whisper.balanced.desc': 'Much better accuracy, especially in Portuguese.',
      'settings.whisper.precise':  'Precise',
      'settings.whisper.precise.desc': 'NVIDIA Parakeet V3: the most accurate and the fastest, but the biggest download. Best for Portuguese.',
      'settings.whisper.note':     'A model is downloaded the first time you use it. Larger models take longer to download the first time.',
      'settings.about.title':  'About',
      'settings.about.desc':   'OpenFatoAI is free and open source (AGPL-3.0). If it helps you, you can support its development.',

      // Home — banner
      'banner.noApiKey.title':  'API key not configured',
      'banner.noApiKey.desc':   'Configure your API key in',
      'banner.noApiKey.link':   'AI Sources',
      'banner.noApiKey.suffix': 'to use AI features.',

      // Home — buttons
      'btn.startRec':          'Start Recording',
      'btn.stopRec':           'Stop Recording',
      'btn.stopRec.loading':   'Processing...',
      'btn.screenshot':        'Capture Full Screen',
      'btn.regionOcr':         'Select Screen Area',
      'btn.regionOcr.default': 'Select Area + OCR',
      'btn.clear':               'Clear',
      'log.rec.started':         'Recording started',
      'log.rec.stopped':         'Recording stopped',
      'log.rec.error':           'Error starting recording:',
      'log.ocr.tesseractMissing.title':   'OCR failed: Tesseract is not installed.',
      'log.ocr.tesseractMissing.windows': 'Install Tesseract-OCR (UB Mannheim build) and make sure tesseract.exe is on your PATH or in C:\\Program Files\\Tesseract-OCR\\.',
      'log.ocr.tesseractMissing.linux':   'Run: sudo apt install tesseract-ocr tesseract-ocr-por tesseract-ocr-eng',
      'log.ocr.tesseractMissing.macos':   'Run: brew install tesseract tesseract-lang',

      'log.audio.permissionDenied.title':   'Error: microphone permission denied.',
      'log.audio.permissionDenied.windows': 'Check Windows Settings → Privacy & security → Microphone, and make sure OpenFatoAI is allowed to access the microphone.',
      'log.audio.permissionDenied.macos':   'Check System Settings → Privacy & Security → Microphone, and make sure OpenFatoAI is authorized to access the microphone.',
      'log.audio.permissionDenied.linux':   'Check your desktop environment\'s privacy/permission settings (GNOME/KDE) and make sure a microphone is available and accessible.',

      'log.audio.deviceError.title':   'Error: could not access the microphone.',
      'log.audio.deviceError.windows': 'Open Windows Settings → Privacy & security → Microphone, scroll to the bottom and enable "Let desktop apps access your microphone". Also check that no other app is using the microphone and that a default input device is set in Sound settings.',
      'log.audio.deviceError.macos':   'Check System Settings → Privacy & Security → Microphone, and make sure no other app is using the microphone.',
      'log.audio.deviceError.linux':   'Check that a microphone device is available (PulseAudio/PipeWire) and that it is not in exclusive use by another app.',
      'btn.sendAi':              'Send AI',
      'btn.sendAi.loading':      'Loading...',
      'btn.transcriptAiShort':   'I want a short AI summary',
      'btn.transcriptAiDetailed':'I want a detailed AI summary',
      'btn.transcriptAiAgenda':  'AI Summary based on Agenda',
      'transcriptions.aiPromptAgenda': 'You are an assistant specialized in summarizing meetings based on an agenda. Read the transcript below and return a structured summary organized by agenda topics: identify what was discussed, decisions made, and action items for each topic. Use clear paragraphs. Plain text only, no markdown, no bullet points, no meta-commentary.',
      'transcriptions.speaker.mic':    '(Me)',
      'transcriptions.speaker.system': 'Video',
      'btn.copy':                'Copy',
      'btn.copy.done':           'Copied!',

      // Home — labels
      'label.prompt':          'Prompt',
      'label.model':           'Model',
      'label.captured':        'Captured Text',
      'label.aiResponse':      'AI Response',

      // Placeholders
      'placeholder.prompt':    'Answer in English. Be direct and brief.',
      'placeholder.apiKey':    'Enter your key here...',

      // Loading overlay / toast
      'loading.wait':          'Please wait...',
      'toast.saved':           'Data saved successfully',

      // Gemini AI page
      'gemini.subtitle':       'Customize the AI model',
      'gemini.model.title':    'Gemini Model',
      'gemini.model.opt1':     'gemini-3.6-flash \u2014 Recommended',
      'gemini.model.opt2':     'gemini-3.5-flash-lite \u2014 Fastest',
      'gemini.model.opt3':     'gemini-3.8-flash \u2014 Most accurate',

      'opencodego.subtitle': 'Configure the OpenCode Go integration',
      'opencodego.model.title': 'OpenCode Go Model',
      'opencodego.key.placeholder': 'API key',
      'opencodego.model.opt1': 'kimi-k3 \u2014 Recommended',
      'opencodego.model.opt2': 'deepseek-v4.1-flash \u2014 Fastest',
      'opencodego.model.opt3': 'glm-5.3-flash \u2014 Balanced',
      'opencodego.model.opt4': 'kimi-k3.1-pro \u2014 Most accurate',
      'toggle.enable.opencodego': 'Enable OpenCode Go',
      'error.opencodegoKey.invalid': 'Invalid key. It must have at least 16 characters and no spaces.',
      'error.opencodegoKey.required': 'Enter your OpenCode Go API key to continue.',
      'ai.sending.opencodego': 'Sending to OpenCode Go\u2026',
      // OpenAI page
      'openai.subtitle':          'Configure the OpenAI integration',
      'openai.model.title':       'OpenAI Model',
      'openai.key.placeholder':   'sk-...',
      'openai.model.opt1':        'gpt-4o-mini — Fastest',
      'openai.model.opt2':        'gpt-4o — Recommended',
      'openai.model.opt3':        'gpt-4.1-mini — Balanced',
      'openai.model.opt4':        'gpt-4.1 — Most accurate',

      // Anthropic page
      'anthropic.subtitle':        'Configure the Anthropic AI integration',
      'anthropic.model.title':     'Anthropic Model',
      'anthropic.key.placeholder': 'sk-ant-...',
      'anthropic.model.opt1':      'claude-haiku-4 — Fastest',
      'anthropic.model.opt2':      'claude-sonnet-4 — Recommended',
            'anthropic.model.opt3':      'claude-opus-4 — Most accurate',

      // Shared (AI pages)
      'shared.model.desc':     'AI model used to process captures and audio',
      'label.getKey':          'Get key',
      'btn.saveSettings':      'Save settings',
      'toggle.enable.gemini':  'Enable Gemini AI',
      'toggle.enable.openai':    'Enable OpenAI',
      'toggle.enable.anthropic':  'Enable Anthropic AI',

      // Settings page
      'settings.title':        'Settings',
      'settings.subtitle':     'Preferences and language',
      'settings.lang.title':   'Language',
      'settings.lang.desc':    'Select the interface language',
      'settings.lang.en':      'English (USA)',
      'settings.lang.ptBR':    'Portugu\u00eas (Brasil)',

      // Validation errors
      'error.apiKey.invalid':     'Invalid key. Must start with “AIza” (39 chars) or “AQ.” (new format).',
      'error.apiKey.required':    'Enter your Gemini API key to continue.',
      'error.openaiKey.invalid':  'Invalid key. Must start with “sk-” followed by at least 20 characters.',
      'error.openaiKey.required':    'Enter your OpenAI API key to continue.',
      'error.anthropicKey.invalid':  'Invalid key. Must start with \"sk-ant-\" followed by at least 20 characters.',
      'error.anthropicKey.required': 'Enter your Anthropic API key to continue.',

      // AI response dynamic text
      'ai.waiting':            'Waiting for AI response\u2026',
      'ai.sending.gemini':     'Sending to Gemini\u2026',
      'ai.sending.openai':     'Sending to OpenAI\u2026',
      'ai.sending.anthropic':  'Sending to Claude\u2026',
      'ai.received':           'Response received.',

      // Default prompt template
      'default.prompt':        'Answer in English. Be direct and brief.\nFirst line: concise answer. Second line: reason in 1 sentence (only if necessary).',

      // Transcriptions page
      'nav.transcriptions':           'Transcriptions',
      'transcriptions.title':         'Transcriptions',
      'transcriptions.subtitle':      'Real-time local speech recognition (offline)',
      'transcriptions.status.idle':   'Idle',
      'transcriptions.status.loading':'Loading model\u2026',
      'transcriptions.status.active':     'Recording\u2026',
      'transcriptions.status.processing':  'Processing',
      'transcriptions.status.error':       'Error',
      'transcriptions.inProgress':    'In progress',
      'transcriptions.log':           'Transcripts',
      'transcriptions.clear':         'Clear',
      'btn.startTranscription':       'Start',
      'btn.stopTranscription':         'Stop',
      'btn.stopTranscription.loading':  'Please wait…',
      'btn.recording':                'Recording',
      'transcriptions.navGuard':      'Transcription in progress. Stop it before navigating.',
      'transcriptions.elapsed':       'Recorded:',
      'transcriptions.aiPrompt':         'Read the transcript below and return a concise summary in 3 to 5 sentences capturing only the main points. Plain text only, no markdown, no bullet points, no explanations.',
      'transcriptions.aiPromptDetailed': 'Read the transcript below and return a detailed analysis: identify the main topic, key points discussed, decisions made, and any action items or conclusions. Use clear paragraphs. Plain text only, no markdown, no bullet points, no meta-commentary.',

      // Support page

      // Plans page

      // Help page
      'nav.help':                   'Help',
      'help.title':                 'Help',
      'help.subtitle':              'Everything you need to know to use OpenFatoAI',
      'help.req.title':             'Prerequisites',
      'help.req.os.label':          'Operating System',
      'help.req.node.label':        'Node.js',
      'help.req.node.desc':         'Node.js v18 or higher. Required to run the app in development mode.',
      'help.req.disk.label':        'Disk Space',
      'help.req.disk.desc':         '~500 MB for the app + ~150 MB for the model (downloaded automatically on first use)',
      'help.req.internet.label':    'Internet Connection',
      'help.req.internet.desc':     'Required only to send text/audio to the active AI provider (Gemini, OpenAI or Anthropic). Speech transcription works 100% offline after the model is downloaded.',
      'help.req.perms.label':       'Required Permissions',
      'help.req.perms.mic':         'Microphone (for recording audio and transcription)',
      'help.req.perms.screen':      'Screen capture (for OCR and full-screen capture)',
      'help.install.title':         'Installation & Setup',
      'help.install.step1':         'Download the installer for your operating system from the releases page.',
      'help.install.step2':         'Run the installer and follow the on-screen instructions. On Linux, grant execute permission to the .AppImage file if needed.',
      'help.install.step3':         'Open OpenFatoAI. An icon will appear in the system tray.',
      'help.install.step4':         'Go to Settings → AI Sources and enter an API key for at least one provider (Gemini, OpenAI or Anthropic) to activate AI features.',
      'help.install.step5':         'Grant microphone and screen capture permissions when requested by the operating system.',
      'help.install.tip':           'An API key from at least one provider (Gemini, OpenAI or Anthropic) is required to use AI features. Speech transcription does not require a key.',
      'help.deps.title':            'Install Dependencies (OCR)',
      'help.deps.desc':             'On Linux, the following tools are required for screen capture and OCR:',
      'help.deps.whisper':          'The model (~150 MB) is downloaded automatically when you first use the Transcriptions tab. No manual installation needed.',
      'help.deps.windows.desc':     'On Windows, OCR requires Tesseract-OCR to be installed separately. Download the installer at',
      'help.deps.windows.desc2':    'and select the Portuguese and English language packs during installation. The app automatically detects the default installation path.',
      'help.deps.macos':            'On macOS, install Tesseract via Homebrew:',
      'help.usage.title':           'How to Use — Step by Step',
      'help.usage.home.title':      '🏠 Home — Capture & AI',
      'help.usage.home.screen.label': 'Capture text from the screen',
      'help.usage.home.screen.s1':  'Leave the content you want to analyze visible on your screen.',
      'help.usage.home.screen.s2':  'Click Capture Full Screen or Select Screen Area (recommended).',
      'help.usage.home.screen.s3':  'The extracted text will appear in the Captured Text panel.',
      'help.usage.home.screen.s4':  'Click ✦ Send AI to get the response in the right panel.',
      'help.usage.home.audio.label': 'Record audio via AI',
      'help.usage.home.audio.s1':   'Click Start Recording and speak or let it capture the conversation.',
      'help.usage.home.audio.s2':   'Click Stop Recording — the audio is processed and sent to the active AI provider.',
      'help.usage.home.audio.s3':   'The AI response will appear in the AI Response panel.',
      'help.usage.trans.title':     '🎙 Transcriptions — Speech to text (offline)',
      'help.usage.trans.s1':        'Click Transcriptions in the sidebar.',
      'help.usage.trans.s2':        'Click Start. On first use, the model (~150 MB) will be downloaded automatically.',
      'help.usage.trans.s3':        'Speak naturally — transcriptions appear in real time.',
      'help.usage.trans.s4':        'Click Stop. AI review buttons will appear.',
      'help.usage.trans.s5':        'Use I want a short AI summary or I want a detailed AI summary to process the transcript with AI.',
      'help.usage.trans.privacy':   'Transcription audio is never sent to any server. Processing is 100% local using the Whisper model.',
      'help.usage.settings.title':  '⚙️ Settings',
      'help.usage.settings.lang':   'Language: Switch the interface between Portuguese (Brazil) and English.',
      'help.usage.settings.theme':  'Theme: Toggle between Light and Dark mode. Saved automatically.',
      'help.usage.settings.hide':   'Hide now: Hides the window immediately. Also use the shortcut Ctrl+Shift+F9.',
      'help.usage.settings.model':  'AI Model (AI Sources): Each provider (Gemini, OpenAI, Anthropic) has its own model selection — choose based on desired speed vs. accuracy.',
      'help.privacy.title':         'Privacy & Security',
      'help.privacy.transcription': 'Speech transcription processed 100% locally — no audio leaves your computer.',
      'help.privacy.ocr':           'OCR processed locally — no images are sent.',
      'help.privacy.gemini':        'Text and audio are sent to the active AI provider only when you click Send AI or Stop Recording.',
      'help.privacy.key':           'Your API key is stored with native OS encryption.',
      'help.privacy.window':        'The window uses content protection and does not appear in screen recordings or streams.',

      // Reuniões page
      'nav.reunions':                  'Meetings',
      'reunions.title':                'Meetings',
      'reunions.subtitle':             'Saved transcriptions',
      'reunions.search':               'Search…',
      'reunions.empty':                'No meetings saved yet.',
      'reunions.col.date':             'Date',
      'reunions.col.type':             'Type',
      'meeting.type.1':                'Quick Actions',
      'meeting.type.2':                'Transcriptions',
      'reunions.col.provider':         'Provider',
      'reunions.col.duration':         'Duration',
      'reunions.col.summary':          'AI Summary',
      'reunions.col.actions':          'Actions',
      'reunions.prev':                 'Previous',
      'reunions.next':                 'Next',
      'reunions.edit.title':           'Edit Meeting',
      'reunions.edit.transcript':      'Transcription',
      'reunions.delete.confirm.title': 'Delete meeting?',
      'reunions.delete.confirm.desc':  'This action cannot be undone.',
      'reunions.delete.confirm.btn':   'Delete',
      'btn.save':                      'Save',
      'btn.saving':                    'Saving…',
      'home.save.success':             'Saved successfully.',
      'btn.edit':                      'Edit',
      'btn.delete':                    'Delete',
      'btn.cancel':                    'Cancel',

      // Tradução (Simultaneous Translation) page
      'meeting.type.3':             'Translation',

      // Kokoro TTS

      // Settings — Kokoro card

      // LibreTranslate

      // Settings — Argos Translate card


      // Email — Send summary


      // Auth — Forgot password

      // Settings — LGPD Consent

      // ── Update
      'update.banner.text': 'A new version {version} is available!',
      'update.banner.cta':  'Download now',
    },

    'pt-BR': {
      // Sidebar
      'nav.section':           'Navega\u00e7\u00e3o',
      'nav.home':              'Home',
      'nav.aiSources':         'AI Sources',
      'nav.settings':          'Configura\u00e7\u00f5es',
      'sidebar.theme':         'Tema',
      'sidebar.theme.dark':    'Escuro',
      'sidebar.theme.light':   'Claro',
      'sidebar.hide':          'Ocultar agora',
      'sidebar.support':       'Me pague um caf\u00e9',
      'settings.whisper.title':    'Modelo de transcri\u00e7\u00e3o',
      'settings.whisper.desc':     'Modelo Whisper local usado na p\u00e1gina de Transcri\u00e7\u00f5es. Vale na pr\u00f3xima vez que voc\u00ea clicar em Iniciar.',
      'settings.whisper.fast':     'R\u00e1pido',
      'settings.whisper.fast.desc': 'O mais leve. Bom para ingl\u00eas e \u00e1udio limpo.',
      'settings.whisper.balanced': 'Equilibrado',
      'settings.whisper.balanced.desc': 'Precis\u00e3o bem melhor, principalmente em portugu\u00eas.',
      'settings.whisper.precise':  'Preciso',
      'settings.whisper.precise.desc': 'NVIDIA Parakeet V3: o mais preciso e o mais r\u00e1pido, mas o maior download. Melhor para portugu\u00eas.',
      'settings.whisper.note':     'O modelo \u00e9 baixado na primeira vez que voc\u00ea o usar. Modelos maiores demoram mais para baixar na primeira vez.',
      'settings.about.title':  'Sobre',
      'settings.about.desc':   'O OpenFatoAI \u00e9 gratuito e de c\u00f3digo aberto (AGPL-3.0). Se ele ajuda voc\u00ea, apoie o desenvolvimento.',

      // Home — banner
      'banner.noApiKey.title':  'Chave de API n\u00e3o configurada',
      'banner.noApiKey.desc':   'Configure sua chave de API em',
      'banner.noApiKey.link':   'AI Sources',
      'banner.noApiKey.suffix': 'para usar os recursos de IA.',

      // Home — buttons
      'btn.startRec':          'Iniciar Grava\u00e7\u00e3o',
      'btn.stopRec':           'Parar Grava\u00e7\u00e3o',
      'btn.stopRec.loading':   'Processando\u2026',
      'btn.screenshot':        'Capturar Tela Inteira',
      'btn.regionOcr':         'Selecionar \u00c1rea Tela',
      'btn.regionOcr.default': 'Selecionar \u00c1rea + OCR',
      'btn.clear':               'Limpar',
      'log.rec.started':         'Gravação iniciada',
      'log.rec.stopped':         'Gravação encerrada',
      'log.rec.error':           'Erro ao iniciar gravação:',
      'log.ocr.tesseractMissing.title':   'OCR falhou: o Tesseract não está instalado.',
      'log.ocr.tesseractMissing.windows': 'Instale o Tesseract-OCR (build UB Mannheim) e garanta que o tesseract.exe esteja no PATH ou em C:\\Program Files\\Tesseract-OCR\\.',
      'log.ocr.tesseractMissing.linux':   'Execute: sudo apt install tesseract-ocr tesseract-ocr-por tesseract-ocr-eng',
      'log.ocr.tesseractMissing.macos':   'Execute: brew install tesseract tesseract-lang',

      'log.audio.permissionDenied.title':   'Erro: permissão de microfone negada.',
      'log.audio.permissionDenied.windows': 'Verifique Configurações do Windows → Privacidade e segurança → Microfone, e garanta que o OpenFatoAI tem permissão para acessar o microfone.',
      'log.audio.permissionDenied.macos':   'Verifique Preferências do Sistema → Privacidade e Segurança → Microfone, e garanta que o OpenFatoAI está autorizado a acessar o microfone.',
      'log.audio.permissionDenied.linux':   'Verifique as configurações de privacidade/permissões de microfone do seu ambiente de desktop (GNOME/KDE) e se há um microfone disponível e acessível.',

      'log.audio.deviceError.title':   'Erro: não foi possível acessar o microfone.',
      'log.audio.deviceError.windows': 'Abra Configurações do Windows → Privacidade e segurança → Microfone, role até o final e ative "Permitir que aplicativos de desktop acessem o microfone". Verifique também se nenhum outro app está usando o microfone e se há um dispositivo de entrada padrão definido em Configurações de Som.',
      'log.audio.deviceError.macos':   'Verifique Preferências do Sistema → Privacidade e Segurança → Microfone, e se nenhum outro app está usando o microfone.',
      'log.audio.deviceError.linux':   'Verifique se há um dispositivo de microfone disponível (PulseAudio/PipeWire) e se ele não está em uso exclusivo por outro app.',
      'btn.sendAi':              'Enviar IA',
      'btn.sendAi.loading':      'Carregando\u2026',
      'btn.transcriptAiShort':   'Quero Um Resumo Curto IA',
      'btn.transcriptAiDetailed':'Quero Um Resumo Detalhado IA',
      'btn.transcriptAiAgenda':  'Resumo de IA baseado na Agenda',
      'transcriptions.aiPromptAgenda': 'Você é um assistente especializado em resumir reuniões com base em uma agenda. Leia a transcrição abaixo e retorne um resumo estruturado organizado por tópicos da agenda: identifique o que foi discutido, as decisões tomadas e os itens de ação para cada tópico. Use parágrafos claros. Somente texto simples, sem markdown, sem lista de tópicos, sem comentários extras.',
      'transcriptions.speaker.mic':    '(Eu)',
      'transcriptions.speaker.system': 'Vídeo',
      'btn.copy':                'Copiar',
      'btn.copy.done':           'Copiado!',

      // Home — labels
      'label.prompt':          'Prompt',
      'label.model':           'Modelo',
      'label.captured':        'Texto Capturado',
      'label.aiResponse':      'Resposta IA',

      // Placeholders
      'placeholder.prompt':    'Responda em portugu\u00eas. Seja direto e breve.',
      'placeholder.apiKey':    'Cole sua chave aqui\u2026',

      // Loading overlay / toast
      'loading.wait':          'Aguarde\u2026',
      'toast.saved':           'Dados salvos com sucesso',

      // Gemini AI page
      'gemini.subtitle':       'Personalize o modelo de IA',
      'gemini.model.title':    'Modelo Gemini',
      'gemini.model.opt1':     'gemini-3.6-flash \u2014 Recomendado',
      'gemini.model.opt2':     'gemini-3.5-flash-lite \u2014 Mais r\u00e1pido',
      'gemini.model.opt3':     'gemini-3.8-flash \u2014 Mais preciso',

      'opencodego.subtitle': 'Configure a integra\u00e7\u00e3o com OpenCode Go',
      'opencodego.model.title': 'Modelo OpenCode Go',
      'opencodego.key.placeholder': 'Chave de API',
      'opencodego.model.opt1': 'kimi-k3 \u2014 Recomendado',
      'opencodego.model.opt2': 'deepseek-v4.1-flash \u2014 Mais r\u00e1pido',
      'opencodego.model.opt3': 'glm-5.3-flash \u2014 Equilibrado',
      'opencodego.model.opt4': 'kimi-k3.1-pro \u2014 Mais preciso',
      'toggle.enable.opencodego': 'Habilitar OpenCode Go',
      'error.opencodegoKey.invalid': 'Chave inv\u00e1lida. Deve ter pelo menos 16 caracteres e n\u00e3o conter espa\u00e7os.',
      'error.opencodegoKey.required': 'Informe sua chave de API do OpenCode Go para continuar.',
      'ai.sending.opencodego': 'Enviando para OpenCode Go\u2026',
      // OpenAI page
      'openai.subtitle':          'Configure a integra\u00e7\u00e3o com OpenAI',
      'openai.model.title':       'Modelo OpenAI',
      'openai.key.placeholder':   'sk-...',
      'openai.model.opt1':        'gpt-4o-mini \u2014 Mais r\u00e1pido',
      'openai.model.opt2':        'gpt-4o \u2014 Recomendado',
      'openai.model.opt3':        'gpt-4.1-mini \u2014 Equilibrado',
      'openai.model.opt4':        'gpt-4.1 \u2014 Mais preciso',

      // Página Anthropic
      'anthropic.subtitle':        'Configure a integração com a IA da Anthropic',
      'anthropic.model.title':     'Modelo Anthropic',
      'anthropic.key.placeholder': 'sk-ant-...',
      'anthropic.model.opt1':      'claude-haiku-4 \u2014 Mais rápido',
      'anthropic.model.opt2':      'claude-sonnet-4 \u2014 Recomendado',
            'anthropic.model.opt3':      'claude-opus-4 \u2014 Mais preciso',

      // Shared (AI pages)
      'shared.model.desc':     'Modelo de IA utilizado para processar capturas e \u00e1udio',
      'label.getKey':          'Obter chave',
      'btn.saveSettings':      'Salvar configura\u00e7\u00f5es',
      'toggle.enable.gemini':  'Habilitar Gemini AI',
      'toggle.enable.openai':    'Habilitar OpenAI',
      'toggle.enable.anthropic':  'Habilitar Anthropic AI',

      // Settings page
      'settings.title':        'Configura\u00e7\u00f5es',
      'settings.subtitle':     'Prefer\u00eancias e idioma',
      'settings.lang.title':   'Idioma',
      'settings.lang.desc':    'Selecione o idioma da interface',
      'settings.lang.en':      'English (USA)',
      'settings.lang.ptBR':    'Portugu\u00eas (Brasil)',

      // Validation errors
      'error.apiKey.invalid':     'Chave inv\u00e1lida. Deve come\u00e7ar com \u201cAIza\u201d (39 caracteres) ou \u201cAQ.\u201d (novo formato).',
      'error.apiKey.required':    'Informe sua chave de API do Gemini para continuar.',
      'error.openaiKey.invalid':  'Chave inv\u00e1lida. Deve come\u00e7ar com \u201csk-\u201d seguido de pelo menos 20 caracteres.',
      'error.openaiKey.required':    'Informe sua chave de API da OpenAI para continuar.',
      'error.anthropicKey.invalid':  'Chave inválida. Deve começar com "sk-ant-" seguido de pelo menos 20 caracteres.',
      'error.anthropicKey.required': 'Informe sua chave de API da Anthropic para continuar.',

      // AI response dynamic text
      'ai.waiting':            'Aguardando resposta da IA\u2026',
      'ai.sending.gemini':     'Enviando para Gemini\u2026',
      'ai.sending.openai':     'Enviando para OpenAI\u2026',
      'ai.sending.anthropic':  'Enviando para Claude\u2026',
      'ai.received':           'Resposta recebida.',
      'error.prefix':          'Erro: ',
      'error.exception':       'Exce\u00e7\u00e3o: ',

      // Default prompt template
      'default.prompt':        'Responda em portugu\u00eas. Seja direto e breve.\n1\u00aa linha: resposta objetiva. 2\u00aa linha: motivo em 1 frase (s\u00f3 se necess\u00e1rio).',

      // Transcriptions page
      'nav.transcriptions':           'Transcri\u00e7\u00f5es',
      'transcriptions.title':         'Transcri\u00e7\u00f5es',
      'transcriptions.subtitle':      'Transcri\u00e7\u00e3o de voz local em tempo real (offline)',
      'transcriptions.status.idle':   'Inativo',
      'transcriptions.status.loading':'Carregando modelo\u2026',
      'transcriptions.status.active':     'A gravar\u2026',
      'transcriptions.status.processing':  'Processando',
      'transcriptions.status.error':       'Erro',
      'transcriptions.inProgress':    'Em progresso',
      'transcriptions.log':           'Transcri\u00e7\u00f5es',
      'transcriptions.clear':         'Limpar',
      'btn.startTranscription':       'Iniciar',
      'btn.stopTranscription':         'Parar',
      'btn.stopTranscription.loading':  'Aguarde…',
      'btn.recording':                'Gravando',
      'transcriptions.navGuard':      'Transcrição em andamento. Pare antes de navegar.',
      'transcriptions.elapsed':       'Gravado:',
      'transcriptions.aiPrompt':         'Leia a transcrição abaixo e retorne um resumo conciso em 3 a 5 frases capturando apenas os pontos principais. Somente texto simples, sem markdown, sem lista de tópicos, sem explicações.',
      'transcriptions.aiPromptDetailed': 'Leia a transcrição abaixo e retorne uma análise detalhada: identifique o tema principal, os pontos-chave discutidos, as decisões tomadas e quaisquer itens de ação ou conclusões. Use parágrafos claros. Somente texto simples, sem markdown, sem lista de tópicos, sem comentários extras.',

      // Página de Suporte

      // Página de Planos

      // Página de Ajuda
      'nav.help':                   'Ajuda',
      'help.title':                 'Ajuda',
      'help.subtitle':              'Tudo que você precisa saber para usar o OpenFatoAI',
      'help.req.title':             'Pré-requisitos',
      'help.req.os.label':          'Sistema Operacional',
      'help.req.node.label':        'Node.js',
      'help.req.node.desc':         'Node.js v18 ou superior. Necessário para executar o app em modo de desenvolvimento.',
      'help.req.disk.label':        'Espaço em Disco',
      'help.req.disk.desc':         '~500 MB para o app + ~150 MB para o modelo (baixado automaticamente na primeira transcrição)',
      'help.req.internet.label':    'Conexão com a Internet',
      'help.req.internet.desc':     'Necessária apenas para enviar texto/áudio ao provedor de IA ativo (Gemini, OpenAI ou Anthropic). A transcrição de fala funciona 100% offline após o download do modelo.',
      'help.req.perms.label':       'Permissões Necessárias',
      'help.req.perms.mic':         'Microfone (para gravar áudio e transcrever)',
      'help.req.perms.screen':      'Captura de tela (para OCR e captura de tela inteira)',
      'help.install.title':         'Instalação e Configuração',
      'help.install.step1':         'Faça o download do instalador para seu sistema operacional na página de releases.',
      'help.install.step2':         'Execute o instalador e siga as instruções na tela. No Linux, dê permissão de execução ao arquivo .AppImage se necessário.',
      'help.install.step3':         'Abra o OpenFatoAI. Um ícone aparecerá na bandeja do sistema.',
      'help.install.step4':         'Vá em Settings → AI Sources e insira a chave de API de pelo menos um provedor (Gemini, OpenAI ou Anthropic) para ativar os recursos de IA.',
      'help.install.step5':         'Conceda as permissões de microfone e captura de tela quando solicitado pelo sistema operacional.',
      'help.install.tip':           'Uma chave de API de pelo menos um provedor (Gemini, OpenAI ou Anthropic) é necessária para usar as funções de IA. A transcrição de fala não requer chave.',
      'help.deps.title':            'Instalar Dependências (OCR)',
      'help.deps.desc':             'No Linux, as ferramentas abaixo são necessárias para captura de tela e OCR:',
      'help.deps.whisper':          'O modelo (~150 MB) é baixado automaticamente ao usar a aba Transcrições pela primeira vez. Nenhuma instalação manual é necessária.',
      'help.deps.windows.desc':     'No Windows, o OCR requer que o Tesseract-OCR seja instalado separadamente. Baixe o instalador em',
      'help.deps.windows.desc2':    'e selecione os pacotes de idioma português e inglês durante a instalação. O app detecta automaticamente o caminho padrão de instalação.',
      'help.deps.macos':            'No macOS, instale o Tesseract via Homebrew:',
      'help.usage.title':           'Como Usar — Passo a Passo',
      'help.usage.home.title':      '🏠 Home — Captura e IA',
      'help.usage.home.screen.label': 'Capturar texto da tela',
      'help.usage.home.screen.s1':  'Deixe o conteúdo que deseja analisar visível na tela.',
      'help.usage.home.screen.s2':  'Clique em Capturar Tela Inteira ou Selecionar Área Tela (recomendado).',
      'help.usage.home.screen.s3':  'O texto extraído aparecerá no painel Texto Capturado.',
      'help.usage.home.screen.s4':  'Clique em ✦ Enviar IA para obter a resposta no painel direito.',
      'help.usage.home.audio.label': 'Gravar áudio via IA',
      'help.usage.home.audio.s1':   'Clique em Iniciar Gravação e fale ou deixe o áudio capturar a conversa.',
      'help.usage.home.audio.s2':   'Clique em Parar Gravação — o áudio é processado e enviado ao provedor de IA ativo.',
      'help.usage.home.audio.s3':   'A resposta da IA aparecerá no painel Resposta IA.',
      'help.usage.trans.title':     '🎙 Transcrições — Fala para texto (offline)',
      'help.usage.trans.s1':        'Clique em Transcrições na sidebar.',
      'help.usage.trans.s2':        'Clique em Iniciar. Na primeira vez, o modelo (~150 MB) será baixado automaticamente.',
      'help.usage.trans.s3':        'Fale normalmente — as transcrições aparecem em tempo real.',
      'help.usage.trans.s4':        'Clique em Parar. Os botões de revisão por IA aparecerão.',
      'help.usage.trans.s5':        'Use Quero Um Resumo Curto IA ou Quero Um Resumo Detalhado IA para processar a transcrição com a IA.',
      'help.usage.trans.privacy':   'O áudio de transcrição não é enviado para nenhum servidor. O processamento é 100% local com o modelo Whisper.',
      'help.usage.settings.title':  '⚙️ Configurações',
      'help.usage.settings.lang':   'Idioma: Alterna a interface entre Português (Brasil) e Inglês.',
      'help.usage.settings.theme':  'Tema: Alterna entre modo Claro e Escuro. Salvo automaticamente.',
      'help.usage.settings.hide':   'Ocultar agora: Esconde a janela imediatamente. Use também o atalho Ctrl+Shift+F9.',
      'help.usage.settings.model':  'Modelo de IA (AI Sources): Cada provedor (Gemini, OpenAI, Anthropic) tem sua própria seleção de modelo — escolha conforme velocidade vs. precisão desejada.',
      'help.privacy.title':         'Privacidade e Segurança',
      'help.privacy.transcription': 'Transcrição de fala processada 100% localmente — nenhum áudio sai do seu computador.',
      'help.privacy.ocr':           'OCR processado localmente — sem envio de imagens.',
      'help.privacy.gemini':        'Texto e áudio são enviados ao provedor de IA ativo somente quando você clica Enviar IA ou Parar Gravação.',
      'help.privacy.key':           'Sua chave de API é armazenada com criptografia nativa do SO.',
      'help.privacy.window':        'A janela usa proteção de conteúdo e não aparece em gravações ou streams de tela.',

      // Página Reuniões
      'nav.reunions':                  'Reuniões',
      'reunions.title':                'Reuniões',
      'reunions.subtitle':             'Transcrições salvas',
      'reunions.search':               'Buscar…',
      'reunions.empty':                'Nenhuma reunião salva ainda.',
      'reunions.col.date':             'Data',
      'reunions.col.type':             'Tipo',
      'meeting.type.1':                'Ações Rápidas',
      'meeting.type.2':                'Transcrições',
      'reunions.col.provider':         'Provedor',
      'reunions.col.duration':         'Duração',
      'reunions.col.summary':          'Resumo IA',
      'reunions.col.actions':          'Ações',
      'reunions.prev':                 'Anterior',
      'reunions.next':                 'Próxima',
      'reunions.edit.title':           'Editar Reunião',
      'reunions.edit.transcript':      'Transcrição',
      'reunions.delete.confirm.title': 'Excluir reunião?',
      'reunions.delete.confirm.desc':  'Esta ação não pode ser desfeita.',
      'reunions.delete.confirm.btn':   'Excluir',
      'btn.save':                      'Salvar',
      'btn.saving':                    'Salvando…',
      'home.save.success':             'Salvo com sucesso.',
      'btn.edit':                      'Editar',
      'btn.delete':                    'Excluir',
      'btn.cancel':                    'Cancelar',

      // Tradução (Tradução Simultânea)
      'meeting.type.3':             'Tradução',

      // Kokoro TTS

      // Configurações — card Kokoro

      // LibreTranslate

      // Configurações — card Argos Translate


      // Email — Envio de resumo


      // Auth — Esqueceu a senha

      // Configurações — Consentimento LGPD

      // ── Update
      'update.banner.text': 'Uma nova versão {version} está disponível!',
      'update.banner.cta':  'Baixar agora',
    },
  };

  // ── Core functions ─────────────────────────────────────────────
  var _lang = localStorage.getItem('lang') || 'en';

  window.getCurrentLang = function () { return _lang; };

  window.t = function (key) {
    return (LOCALES[_lang] && LOCALES[_lang][key])
      || (LOCALES['en'][key])
      || key;
  };

  window.applyLocale = function (lang) {
    // Preserve current default prompt so we can detect whether the user
    // is still using the default (and therefore safe to replace) when
    // switching languages.
    var prevDefaultPrompt = window.t('default.prompt');

    _lang = lang;
    localStorage.setItem('lang', lang);
    if (window.electronAPI && window.electronAPI.saveConfig) {
      window.electronAPI.saveConfig({ language: lang }).catch(function () {});
    }

    // Text content
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = window.t(el.dataset.i18n);
    });

    // Placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = window.t(el.dataset.i18nPlaceholder);
    });

    // Title (tooltip) attributes
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.title = window.t(el.dataset.i18nTitle);
    });

    // data-default (used by setBtnLoading to restore btn-label text)
    document.querySelectorAll('[data-i18n-default]').forEach(function (el) {
      el.dataset.default = window.t(el.dataset.i18nDefault);
    });

    // Theme label (dynamic — depends on current dark/light state)
    var isDark = document.documentElement.classList.contains('dark');
    var tl = document.getElementById('themeLabel');
    if (tl) tl.textContent = isDark ? window.t('sidebar.theme.light') : window.t('sidebar.theme.dark');

    // Sync language radio buttons
    var langEn   = document.getElementById('langEn');
    var langPtBR = document.getElementById('langPtBR');
    if (langEn)   langEn.checked   = (lang === 'en');
    if (langPtBR) langPtBR.checked = (lang === 'pt-BR');

    // If the prompt textarea is present and its value matches the previous
    // locale's default prompt, replace it with the new locale's default.
    try {
      var promptEl = document.getElementById('promptTemplate');
      if (promptEl && typeof promptEl.value === 'string') {
        if (promptEl.value === prevDefaultPrompt) {
          promptEl.value = window.t('default.prompt');
        }
      }
    } catch (e) {
      // ignore DOM access errors
    }
  };

  // Attach Settings radio listeners (DOM is ready — script is at end of <body>)
  var langEn   = document.getElementById('langEn');
  var langPtBR = document.getElementById('langPtBR');
  if (langEn)   langEn.addEventListener('change',   function () { window.applyLocale('en'); });
  if (langPtBR) langPtBR.addEventListener('change', function () { window.applyLocale('pt-BR'); });

  // Apply on load
  window.applyLocale(_lang);
})();
