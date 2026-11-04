# OpenFatoAI — documentação

[English](README.md) · **Português (BR)**

Para regras e arquitetura do dia a dia, veja o [`CLAUDE.md`](../CLAUDE.md) na raiz.

| Pasta | Conteúdo |
|---|---|
| [`usuario/`](usuario/guia-usuario.md) | Guia do usuário final ([Português](usuario/guia-usuario.md) · [English](usuario/user-guide.md)). |
| [`padroes/`](padroes/README.md) | Fluxo de feature e convenções por área: especificação, backend (main process), frontend, QA e DevOps. *(Somente em português.)* |
| [`../backend/`](../backend/README.md) | Backend avulso (.NET 8 + PostgreSQL): tabelas, funções e endpoints. **O app desktop não usa.** |
| [`../docker/`](../docker/README.md) | Docker: PostgreSQL + API desse backend, HTTPS opcional (Caddy) e serviços avulsos. |
