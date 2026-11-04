# OpenFatoAI — documentation

**English** · [Português (BR)](README.pt-BR.md)

For day-to-day rules and architecture, see [`CLAUDE.md`](../CLAUDE.md) at the repository root.

| Folder | Contents |
|---|---|
| [`usuario/`](usuario/user-guide.md) | End-user guide ([English](usuario/user-guide.md) · [Português](usuario/guia-usuario.md)). |
| [`padroes/`](padroes/README.md) | Feature flow and per-area conventions: specification, backend (main process), frontend, QA and DevOps. *(Portuguese only.)* |
| [`../backend/`](../backend/README.md) | Standalone backend (.NET 8 + PostgreSQL): tables, functions and endpoints. **The desktop app does not use it.** |
| [`../docker/`](../docker/README.md) | Docker: PostgreSQL + API for that backend, optional HTTPS (Caddy) and standalone services. |
