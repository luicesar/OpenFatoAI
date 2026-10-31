# Especificação de contratos

Um contrato técnico define, antes da implementação, o formato exato da comunicação entre backend (main process) e frontend (renderer). Os contratos ficam na descrição da issue ou PR da feature.

## Ao especificar

1. Leia os contratos existentes e o estado atual do código:
   - `src/shared/constants.js` — canais IPC existentes
   - `src/services/database.js` — schema atual da tabela `meetings`
   - `src/main/preload.js` — métodos já expostos
2. Escreva o contrato com o template abaixo, com status `EM ANDAMENTO`.
3. Avise quem vai implementar que o contrato está registrado.

## Regras

- camelCase para config/JS, snake_case para DB
- Retorno IPC sempre `{ ok, data?, error? }` via `ok()`/`fail()` de `shared/utils`
- IDs HTML: kebab-case. Chaves i18n: `namespace.acao`
- Anthropic não aceita áudio — se a feature envolver áudio + Anthropic, especificar o fallback
- Se houver conflito entre backend e frontend, emita revisão `[REV 2]` no contrato

## Template

```markdown
## [NOME DA FEATURE] — Status: EM ANDAMENTO
**Data:** YYYY-MM-DD

### Interface / API
Canal IPC:  nome-do-canal
Payload entrada:  { campo1: tipo, campo2: tipo | null }
Payload saída:
  Sucesso: { ok: true,  data: { campo: tipo } }
  Erro:    { ok: false, error: string }

### Banco de dados (se houver)
Tabela: [nome] — novos campos:
  nome_campo  TIPO  NOT NULL DEFAULT ''

### Config (se houver)
  nomeConfig: tipo

### i18n / Strings (se houver)
  'chave.nova'  pt-BR: 'Texto'  en: 'Text'

### Componentes UI (se houver)
  [descrição dos componentes, props, eventos]

### Critérios de aceite
- [ ] Comportamento esperado 1
- [ ] Comportamento esperado 2

### Handshake (preenchido pelo backend após implementar)
_aguardando..._
```

## Ciclo de vida

```
EM ANDAMENTO  →  backend preenche o Handshake
              →  frontend implementa
              →  QA marca critérios [OK]/[FALHOU]
              →  [ENTREGUE]
```

## Handshake (anti-conflito)

O risco principal é backend e frontend tomarem decisões independentes sobre o mesmo contrato. A solução tem 3 camadas:

1. **Especificação** define nomes, tipos e formato de retorno exatos.
2. **Backend** implementa e escreve o Handshake, copiando a assinatura exata da interface para o contrato.
3. **Frontend** lê o Handshake e copia verbatim — nunca reinterpreta, nunca assume.

```markdown
### Handshake (preenchido pelo backend após implementar)
Preload (copiar verbatim em preload.js):
  nomeAcao: (payload) => ipcRenderer.invoke('nome-do-canal', payload)
Retorno garantido:
  { ok: true,  data: { campo: tipo } }
  { ok: false, error: string }
Arquivo: src/main/ipc/xxx.js — linha XX registrada em index.js
```
