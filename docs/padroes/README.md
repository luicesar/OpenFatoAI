# Padrões de desenvolvimento

Convenções e fluxo de trabalho do OpenFatoAI, organizados por área. Consolidam o que antes estava distribuído em prompts e guias antigos (o material original continua no histórico do git, commit `6afd933` e anteriores).

| Arquivo | Conteúdo |
|---|---|
| [`especificacao.md`](especificacao.md) | Como escrever um contrato técnico (IPC, DB, config, i18n), template, handshake e ciclo de vida. |
| [`backend.md`](backend.md) | Processo principal: handlers IPC, serviços de IA, banco, resolução de config. |
| [`frontend.md`](frontend.md) | Renderer: chamadas IPC, i18n, páginas, loading, multi-provider, CSS. |
| [`qa.md`](qa.md) | Validação: critérios de aceite, formato de bug, checklists, . |
| [`devops.md`](devops.md) | Ambiente, diagnóstico, build, empacotamento e release. |

## Fluxo de uma feature

```
1. Especificação   → contrato descrito na issue ou PR (antes de qualquer código)
2. Backend         → implementa o contrato e escreve o Handshake
3. Frontend        → lê o Handshake e implementa a UI (pode começar após o passo 2)
4. QA              → valida os critérios de aceite ([OK] / [FALHOU])
5. Documentação    → atualiza README/docs e docs/usuario/guia-usuario.md
6. Fechar          → issue/PR concluída e CHANGELOG atualizado
```

**Regra principal:** nunca implemente backend ou frontend sem contrato registrado. As duas camadas ficam em processos opostos (main vs renderer); se cada uma decidir o payload sozinha, o bug só aparece em runtime.

Os passos 3 e 4 podem andar em paralelo se os critérios de aceite não exigirem a UI pronta.

### Passo 5 — Documentação

Pule se for refactor interno, bugfix sem mudança de comportamento ou ajuste de CSS. Caso contrário:

- Documentação técnica (README e `docs/`) — backend primeiro, depois frontend, cada um só nas seções do seu domínio:
  - Backend: tabela de handlers IPC (novo canal, arquivo, descrição), schema da tabela `meetings` (novas colunas), stack (nova dependência), resolução de config (se a prioridade de chaves mudou).
  - Frontend: renderer (novas páginas, seções, fluxo de UI), internacionalização (novas chaves), aba Reuniões (tabela, modal, paginação), multi-provider na UI (`applyActiveAiSource`, `extractAiText`).
- `docs/usuario/guia-usuario.md` — só o que mudou para o usuário: funcionalidades, atalhos de teclado, tabela de provedores de IA. Preserve tom e estilo.

Se nada mudou no domínio, não edite o arquivo.

### Conflito entre backend e frontend

1. Pare o trabalho nas duas camadas.
2. Reabra o contrato e registre uma revisão `[REV 2]` que decide o formato.
3. Backend ajusta e emite novo Handshake.
4. Frontend relê o Handshake e atualiza o renderer.

## Regras de arquitetura (não negocie)

- Nenhuma lógica privilegiada no renderer — tudo vai para `src/main/ipc/`.
- Novos canais IPC obrigatoriamente registrados em `src/main/index.js`.
- API keys sempre via `safeStorage` — nunca em localStorage ou texto plano.
- `Float32Array` de áudio nunca serializado com `Array.from()` — passa direto via IPC.
- Toda string de UI precisa de chave em `i18n.js` (PT-BR + EN).
