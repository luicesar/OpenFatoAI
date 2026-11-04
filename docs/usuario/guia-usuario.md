# OpenFatoAI — Guia do Usuário

## O que é o OpenFatoAI?

O OpenFatoAI é um assistente discreto para desktop que fica na bandeja do sistema. Ele captura o que está acontecendo na sua tela ou microfone, envia para a IA e devolve respostas rápidas — tudo sem sair da sua janela atual. Também realiza **transcrição automática de fala** em tempo real, 100% local, sem enviar áudio para servidores externos.

O app suporta quatro provedores de IA: **Gemini** (Google), **OpenAI** (GPT), **Anthropic** (Claude) e **OpenCode Go** (Kimi, DeepSeek, GLM…).

**Casos de uso principais:**
- Capturar texto de uma pergunta na tela e receber a resposta da IA
- Transcrever automaticamente áudio de uma reunião, vídeo ou conversa em tempo real
- Selecionar uma área específica da tela para extrair e processar apenas o texto relevante
- Gravar áudio e obter análise via IA
- Consultar o histórico de sessões salvas na aba Reuniões

---

## Pré-requisitos

Antes de usar o app pela primeira vez:

1. **Node.js** instalado (v18 ou superior)
2. Uma **chave de API** de pelo menos um provedor:
   - Gemini: [Google AI Studio](https://aistudio.google.com/app/apikey) (gratuito)
   - OpenAI: [platform.openai.com](https://platform.openai.com/api-keys)
   - Anthropic: [console.anthropic.com](https://console.anthropic.com/)
   - OpenCode Go: [opencode.ai](https://opencode.ai/) (plano Go)
3. Ferramentas necessárias para captura de tela e OCR:
   - **Linux**:
     ```bash
     sudo apt install scrot tesseract-ocr tesseract-ocr-por tesseract-ocr-eng
     ```
     > O pacote `.deb` do app já instala essas dependências automaticamente.
   - **Windows**: o OCR requer que o Tesseract-OCR seja instalado separadamente. Baixe o instalador em [github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki) e selecione os pacotes de idioma português e inglês durante a instalação. O app detecta automaticamente o caminho padrão de instalação.
   - **macOS**: instale o Tesseract via Homebrew:
     ```bash
     brew install tesseract tesseract-lang
     ```

---

## Instalação e Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar o arquivo `.env` (opcional)

As chaves de API podem ser configuradas pela interface do app (Settings). O `.env` é opcional e serve para pré-configurar o provedor padrão:

```
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-3.6-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models
DEFAULT_PROMPT="Responda em português. Seja direto e breve."
```

### 3. Iniciar o app

```bash
# Uso normal
npm start

# Desenvolvimento (com watch de CSS)
npm run dev
```

Um ícone aparecerá na **bandeja do sistema** (system tray). Clique nele para abrir a janela, ou use o atalho `Ctrl+Shift+F9`.

---

## Interface do App

A janela possui uma **sidebar de navegação** à esquerda e a **área principal** à direita com as seções: Home, Transcrições, Reuniões, Provedores de IA, Settings e Ajuda.

### Sidebar (esquerda)

- **Marca** — "OpenFatoAI" no topo da sidebar
- **Navegação** — botões para cada seção
- **Tema** — alterna entre modo claro e escuro; salvo automaticamente
- **Ocultar agora** — botão vermelho para esconder a janela imediatamente
- **Atalho** — exibe `Ctrl+Shift+F9`

---

## Seção Home

A Home é a área principal para captura rápida de tela ou áudio com análise de IA.

### Layout

```
┌───────────────────────────────────────────────────────────┐
│ [● Iniciar Gravação] [■ Parar Gravação]                   │
│ [📷 Capturar Tela]   [⬚ Selecionar Área]  [badge IA]     │
│ PROMPT [campo de texto]    MODELO [dropdown]              │
├─────────────────────────┬─────────────────────────────────┤
│ TEXTO CAPTURADO         │ RESPOSTA IA                     │
│ [Limpar] [✦ Enviar IA]  │ [Copiar]  [Salvar]              │
└─────────────────────────┴─────────────────────────────────┘
```

### Botões de captura

| Botão | Função |
|---|---|
| **● Iniciar Gravação** | Inicia gravação pelo microfone; mostra timer no botão |
| **■ Parar Gravação** | Para e envia o áudio para a IA automaticamente |
| **📷 Capturar Tela Inteira** | Tira screenshot + OCR da tela toda |
| **⬚ Selecionar Área Tela** | Abre overlay para selecionar região da tela + OCR |

### Fluxo de captura

1. Use um dos botões acima para capturar texto ou gravar áudio
2. O conteúdo extraído aparece no painel **Texto Capturado** (esquerda)
3. Ajuste o **Prompt** e o **Modelo** se necessário
4. Clique em **✦ Enviar IA** para obter a resposta
5. A resposta aparece no painel **Resposta IA** (direita)
6. Use **Copiar** para copiar o resultado ou **Salvar** para gravar na aba Reuniões

### Botão Limpar

O botão **Limpar** (aparece ao lado de **✦ Enviar IA**) apaga o texto do painel Texto Capturado, oculta o painel Resposta IA e esconde os botões Copiar e Salvar.

> Iniciar uma nova gravação também limpa automaticamente a resposta anterior.

### Botão Salvar

O botão **Salvar** aparece somente após a IA retornar uma resposta. Ele persiste a sessão completa (texto capturado + resposta IA + provedor + modelo + duração) na aba **Reuniões** para consulta futura.

### Provedor ativo (badge)

O **badge colorido** ao lado dos botões de captura indica qual provedor de IA está ativo:
- **Gemini** — azul índigo
- **OpenAI** — verde esmeralda
- **Claude** — laranja

---

## Seção Transcrições

Transcrição automática de fala em tempo real, 100% local via Whisper.

### Como usar

1. Clique em **Transcrições** na sidebar
2. Clique em **Iniciar** — na **primeira vez**, o modelo Whisper (~142 MB) será baixado automaticamente; aguarde o progresso
3. O botão passa a mostrar um **timer** (ex: `00:45`) enquanto grava
4. Fale normalmente — as transcrições aparecem em tempo real no log
5. Clique em **Parar** — o timer some e aparece o **tempo total gravado** (ex: `Em progresso | Gravado: 01:23`)
6. Clique em um dos botões de resumo para processar com IA

> **Atenção:** Você não pode trocar de seção enquanto a transcrição estiver ativa. Um aviso aparecerá se tentar navegar.

### Seletor de modelo de IA

No topo da tela há um **seletor de modelo** (dropdown) e um badge com o nome do provedor ativo — idêntico ao da Home. Você pode trocar o modelo sem sair da tela; a alteração sincroniza automaticamente com o seletor da Home.

### Sobre o Whisper

- Modelo: `xenova/whisper-base` (~142 MB) — baixado automaticamente no primeiro uso
- Roda **100% no seu computador** — nenhum áudio é enviado para servidores externos
- Idioma configurável nas Settings (Português Brasileiro e Inglês têm boa acurácia)
- Chunks de 10 segundos com detecção de silêncio — áudio silencioso é ignorado

### Tipos de resumo IA

| Botão | Resultado |
|---|---|
| **Resumo Curto** | 3 a 5 frases com os pontos principais; texto simples |
| **Resumo Detalhado** | Análise completa: tema, pontos-chave, decisões, itens de ação; em parágrafos |
| **Resumo de IA baseado na Agenda** | Resumo estruturado por tópicos da agenda: o que foi discutido, decisões e itens de ação por tópico |

---

## Seção Reuniões

Histórico de todas as sessões salvas (Home e Transcrições).

### Tabela

- **Data** — quando a sessão foi criada; formato `DD/MM/YYYY HH:MM` em português, `MM/DD/YYYY hh:mm AM/PM` em inglês
- **Tipo** — badge amber = Ações Rápidas (salvo pela Home), badge índigo = Transcrições
- **Provedor** — modelo de IA usado
- **Duração** — segundos gravados
- **Resumo** — prévia do texto da resposta IA
- **Ações** — editar ✏️ ou excluir 🗑️

### Busca

Digite qualquer termo na barra de busca para filtrar por resumo, transcrição ou provedor.

### Editar uma sessão

Clique no ícone ✏️ para abrir o modal de edição. Os campos de texto não ativam o corretor ortográfico do browser (sem sublinhado vermelho). Você pode alterar qualquer campo (resumo, transcrição, prompt, modelo) e salvar as alterações.

### Excluir uma sessão

Clique no ícone 🗑️ e confirme para remover o registro permanentemente.

---

## Configurações (Settings)

Acesse clicando em **Settings** (engrenagem) na sidebar.

### Provedor Gemini

Configure a chave de API e escolha o modelo:

| Modelo | Quando usar |
|---|---|
| `gemini-3.5-flash-lite` | Máxima velocidade, tarefas simples |
| `gemini-3.6-flash` | **Recomendado** — rápido e preciso |
| `gemini-3.8-flash` | Questões complexas que exigem mais raciocínio |

### Provedor OpenAI (GPT)

Configure a chave de API e escolha o modelo:

| Modelo | Quando usar |
|---|---|
| `gpt-4o-mini` | Rápido, baixo custo |
| `gpt-4o` | Mais capaz, equilibrado |
| `gpt-4.1-mini` | Versão leve do GPT-4.1 |
| `gpt-4.1` | Alta capacidade |

### Provedor OpenCode Go

Modelos: `kimi-k3` (recomendado), `deepseek-v4.1-flash` (mais rápido), `glm-5.3-flash` (equilibrado) e `kimi-k3.1-pro` (mais preciso). O OpenCode Go não aceita áudio: ao gravar, o app transcreve antes com o Whisper da OpenAI ou com o Gemini, então é preciso ter uma dessas chaves configurada.

### Provedor Anthropic (Claude)

Configure a chave de API e escolha o modelo:

| Modelo | Quando usar |
|---|---|
| `claude-haiku-4` | Mais rápido e econômico |
| `claude-sonnet-4` | **Recomendado** — equilíbrio entre velocidade e qualidade |
| `claude-opus-4` | Máxima capacidade |

### Alternar provedor

Cada provedor tem um **toggle** na página de configurações. Ativar um provedor desativa o anterior. O badge na Home muda para refletir o provedor ativo.

> **Anthropic na Home:** Como Claude não aceita entrada de áudio, ao gravar com Anthropic ativo o app captura a transcrição local via Web Speech API e envia o texto para a IA (em vez do áudio).

## Prompt Template

O campo **Prompt** na Home define o contexto ou instrução enviada junto com o texto capturado. Exemplos:

```
Responda em português. Indique a alternativa correta e explique em 1 frase.
```
```
Resuma o texto em até 3 tópicos curtos.
```
```
Você é um especialista em direito tributário. Analise o texto e destaque os pontos críticos.
```

> Deixe vazio para usar o prompt padrão definido no `.env`.

---

## Tema (Claro / Escuro)

O botão **Tema** na sidebar alterna entre Light e Dark. A preferência é salva automaticamente e aplicada na próxima abertura do app.

---

## Atalho de Teclado

| Atalho | Ação |
|---|---|
| `Ctrl+Shift+F9` | Mostrar / Ocultar a janela do app |

> **Por que não `Ctrl+Shift+Space`?** No Linux, esse atalho é capturado pelo IBus (método de entrada de idiomas asiáticos) antes de chegar ao app.

O botão **Ocultar agora** (vermelho) na sidebar faz o mesmo — útil para esconder rapidamente o app durante uma apresentação.

---

## Privacidade e Segurança

- **Transcrição** — processada **100% localmente** pelo Whisper; nenhum áudio é enviado para servidores externos
- **OCR** — processado localmente pelo Tesseract; sem envio de imagens
- **IA** — texto e áudio são enviados ao provedor **somente** quando você clica Enviar IA ou para a gravação
- **Chaves de API** — armazenadas com criptografia nativa do SO (`safeStorage` do Electron)
- **Janela invisível** — `setContentProtection(true)` impede a janela de aparecer em gravações/streams de tela
- **Banco de dados** — armazenado localmente em `~/.config/openfatoai/fato-ai.db`; só é espelhado em um servidor se **você** configurar um em Configurações → Sincronização

---

## Fluxo de Trabalho Sugerido

```
1. Identifique a pergunta/conteúdo na sua tela
         ↓
2. Use "Selecionar Área Tela" para capturar só o relevante
         ↓
3. Confirme o texto extraído no painel Texto Capturado
         ↓
4. Ajuste o prompt e o modelo se necessário
         ↓
5. Clique "Enviar IA" e leia a resposta no painel direito
         ↓
6. Clique "Salvar" para guardar na aba Reuniões
         ↓
7. Oculte o app com Ctrl+Shift+F9
```

---

## Solução de Problemas

### "No screenshot binary found"
Instale o `scrot`:
```bash
sudo apt install scrot
```

### Erro 404 da API Gemini
O modelo selecionado pode não estar disponível para sua chave. Troque para `gemini-3.6-flash` nas Settings.

### Banner "Configure sua chave de API"
Acesse Settings, insira a chave do provedor ativo e clique **Salvar configurações**.

### O texto OCR está impreciso
- Use **Selecionar Área** em vez de captura de tela inteira
- Certifique-se de que `tesseract-ocr-por` está instalado para textos em português (Linux/macOS) ou que o pacote de idioma português foi selecionado na instalação do Tesseract (Windows)

### Transcrição Whisper demorada no primeiro uso
O modelo (~142 MB) é baixado automaticamente uma única vez. Uma barra de progresso é exibida durante o download.

### "Not responding" ao parar gravação longa
Esse problema foi corrigido — o áudio agora é transmitido diretamente via memória compartilhada, sem serialização lenta.
