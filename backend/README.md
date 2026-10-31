# OpenFatoAI backend (opcional)

API em **.NET 8 + Dapper + PostgreSQL** (testado com 12 e 16). É **opcional**: o app desktop funciona 100% local (SQLite). O backend serve para guardar as reuniões em Postgres, entregar configurações globais e o aviso de nova versão. **Não há login, contas, planos nem pagamentos.**

## Como identifica cada instalação
Sem login, cada instalação do app gera um UUID aleatório (`installation_id`, sem dados pessoais) e o envia no header `X-Installation-Id`. As reuniões são sempre filtradas por esse ID.

## Estrutura
```
OpenFatoAI.Api/            controllers, middlewares, Program.cs
OpenFatoAI.Domain/         entidades
OpenFatoAI.Infrastructure/ DatabaseContext, repositórios, SQL/ (migrações)
```

## Banco de dados (5 tabelas)
| Tabela | Função |
|---|---|
| `meetings` | sessões salvas (tipo 1 = Home, 2 = Transcrições), por `installation_id` |
| `app_settings` | listas de modelos de IA e config dos serviços opcionais (Kokoro, LibreTranslate) |
| `app_version` | versões publicadas (aviso de atualização) |
| `action_logs` | auditoria simples |
| `migrations_history` | controle de migrações |

**Regra de arquitetura:** todo SELECT/INSERT/UPDATE/DELETE é uma *stored function* `fn_<verbo>_<entidade>` em `OpenFatoAI.Infrastructure/SQL/`. Os repositórios C# só chamam funções; **nenhum SQL de tabela inline** nos `.cs`. Novas funções entram em migrações numeradas (`002_...sql`). O `000_bootstrap.sql` roda sempre primeiro.

## Endpoints
| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | saúde |
| GET | `/api/settings/{key}` | configuração global |
| PUT | `/api/settings/{key}` | atualiza (exige `X-Api-Key` = `Security__ApiKey`; desativado se a chave não estiver configurada) |
| GET | `/api/app/latest-version` | versão mais recente publicada |

### Reuniões (exigem o header `X-Installation-Id` com um UUID válido)
| Método | Rota | Descrição |
|---|---|---|
| PUT | `/api/meetings/{sessionHash}` | cria ou **substitui** a reunião (idempotente; campos omitidos viram nulos). Corpo: `meetingType` (1 ou 2), `summaryType`, `transcriptText`, `aiSummary`, `promptUsed`, `recordedSeconds`, `aiProvider`, `aiModel`, `language`. Responde `{ id, sessionHash }` |
| GET | `/api/meetings?type=&search=&page=&pageSize=` | lista paginada (até 100 por página), mais recentes primeiro. Responde `{ items, total, page, pageSize }` |
| GET | `/api/meetings/{id}` | uma reunião |
| DELETE | `/api/meetings/{id}` | apaga (204) |
| DELETE | `/api/meetings/by-session/{sessionHash}` | apaga pela chave de sessão do app (usada na sincronização) |

Uma instalação nunca enxerga as reuniões de outra: o `404` vale para reuniões que não existem ou são de outro `installation_id`. `sessionHash`: 1–64 caracteres entre letras, dígitos, `-` e `_`.

## Rodar
Com Docker (recomendado), veja [`../docker/README.md`](../docker/README.md):
```bash
cd docker && cp .env.example .env   # defina POSTGRES_PASSWORD
docker compose up -d --build
```
Variáveis da API: `ConnectionStrings__DefaultConnection`, `CorsSettings__Origins`, `Security__ApiKey`.
