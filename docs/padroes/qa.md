# QA e validação

Valida que as features entregues correspondem aos critérios de aceite do contrato (issue ou PR) e reporta bugs com precisão.

## Ao validar

1. Leia os critérios de aceite da feature no contrato.
2. Leia os arquivos de implementação — nunca confie apenas no resumo de quem implementou.
3. Para cada critério, verifique via `grep`, leitura de código ou execução.
4. Marque cada critério com `[OK]` ou `[FALHOU: descrição]` no contrato.
5. Reporte bugs no formato padrão.

## Formato de reporte de bug

```
BUG: [descrição curta]
Contrato: [nome da feature]
Passos: 1. ... 2. ... 3. ...
Esperado: [o que o contrato diz]
Atual: [o que aconteceu]
Arquivo: [caminho:linha]
Domínio: backend | frontend | devops
Severidade: bloqueador | alto | médio | baixo
Sugestão de fix: [o que deve mudar]
```

## Checklist geral (qualquer feature)

- [ ] Tela carrega sem erros de console
- [ ] Dark/light mode respeitados
- [ ] i18n funcionando em PT-BR e EN
- [ ] Estados de loading exibidos
- [ ] Estados de erro com mensagem amigável
- [ ] Dados vazios: mostrar "nenhum resultado"
- [ ] Rede offline: mensagem clara, sem crash
- [ ] Input extremo (textos longos, caracteres especiais)

## Checklist permanente — Gravação de áudio (Home)

- [ ] Timer aparece no botão durante gravação
- [ ] Botão "Parar" mostra spinner após clique (não trava)
- [ ] Silêncio (RMS < 0.008) não envia para IA
- [ ] Anthropic ativo: usa Web Speech API → envia como texto
- [ ] Resposta IA aparece; botão Salvar aparece

## Checklist permanente — OCR

- [ ] OCR tela inteira: texto no log, loading some
- [ ] Seleção de área: overlay abre, OCR executa
- [ ] Sem Tesseract: erro amigável, sem crash

## Checklist permanente — Transcrições (Whisper)

- [ ] Primeiro uso: download com barra de progresso
- [ ] Guard: toast ao tentar trocar aba durante transcrição
- [ ] Botões resumo IA (Curto / Detalhado / Agenda) funcionam
- [ ] Timer exibe tempo; ao parar mostra "Gravado: MM:SS"

## Checklist permanente — Reuniões (DB)

- [ ] Sessão Home: badge amber (Ações Rápidas)
- [ ] Transcrição: badge indigo (Transcrições)
- [ ] Busca full-text funciona
- [ ] Modal de edição salva; exclusão com confirmação
- [ ] Paginação: 15 por página

## Checklist permanente — Multi-provider

- [ ] Troca de provider atualiza badge e dropdown
- [ ] API key persiste entre sessões
- [ ] Provider sem chave: erro claro, sem crash

## Checklist permanente — Edge cases

- [ ] Gravação longa (>5 min): sem "not responding"
- [ ] DB corrompido: app inicia, IPC retorna erro
- [ ] Todos providers sem chave: OCR funciona, só IA falha

## Outras especialidades — i18n

- Chaves novas presentes em PT-BR e EN
- Troca de idioma → strings recarregadas imediatamente
- Sem texto hardcoded em HTML ou JS

## Outras especialidades — Dark Mode

- Novos elementos respeitam classes `dark:` do Tailwind
- Tema persiste entre sessões
- Sem flash branco ao iniciar em modo escuro

## Outras especialidades — IPC Contract

- Canal novo existe em `src/shared/constants.js`
- Canal exposto via `contextBridge` em `preload.js`
- Handler registrado em `src/main/index.js` via `registerXxxHandlers()`

## Início dos testes

```bash
# Electron
npm run dev   # Ctrl+Shift+I para DevTools
```
