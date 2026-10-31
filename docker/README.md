# Docker

## Backend (Postgres + API) — `docker-compose.yml`
Stack opcional para guardar as reuniões no seu próprio servidor. O app funciona sem ela.

```bash
cd docker
cp .env.example .env     # defina POSTGRES_PASSWORD (e, se quiser, SECURITY_API_KEY)
docker compose up -d --build
curl http://127.0.0.1:5000/health     # {"status":"healthy"}
```

No app: **Configurações → Sincronização**, informe a URL (`http://127.0.0.1:5000` na mesma máquina), **Testar conexão** e **Sincronizar agora**.

- As migrações SQL rodam sozinhas quando a API inicia.
- Os dados ficam no volume `pg_data`. `docker compose down` preserva; `docker compose down -v` **apaga** o banco.
- O app exige `https://` para servidores fora de `localhost`/rede privada. Para a internet, defina `DOMAIN` no `.env` e use o perfil `https` (Caddy com certificado automático):
  `docker compose --profile https up -d --build`

## Serviços opcionais avulsos
`kokoro/` (voz) e `libretranslate/` (tradução) são compose independentes, mantidos como estavam. **O app atual não os utiliza** (a página de Tradução foi removida junto com as rotas do backend hospedado), então servem apenas para uso manual ou para uma futura integração.

```bash
docker compose -f kokoro/docker-compose.yml up -d
docker compose -f libretranslate/docker-compose.yml up -d
```
