# Infraestrutura

## Local (desenvolvimento)

```bash
docker compose -f infrastructure/docker-compose.yml up -d postgres          # só o banco
docker compose -f infrastructure/docker-compose.yml --profile api up -d --build   # banco + API
docker compose -f infrastructure/docker-compose.yml down                     # parar (dados ficam no volume)
```

- PostgreSQL 17 em `localhost:55432` (usuário/senha `imperio`, apenas local), bancos `imperio`
  e `imperio_test` (criado por `postgres/01-test-db.sql` na primeira subida do volume).
- A API em container aplica migrações (`prisma migrate deploy`) e o catálogo antes de subir.

## Staging e produção (Dockploy) — ainda não configurado

Planejado (docs/PLANO_PUBLICACAO_INFRA_MONETIZACAO.md §24):
- Uma stack por ambiente, com banco, volumes e segredos separados (`DATABASE_URL`,
  `JWT_SECRET` forte, `NODE_ENV=production`). A API recusa `JWT_SECRET` de exemplo em produção.
- Deploy do backend a partir do GitHub com filtro de caminho `backend/**`.
- HTTPS no proxy, backups automáticos do PostgreSQL com restauração testada, healthcheck
  em `/health`, rate limiting, logs sem dados pessoais.
- Domínios a confirmar: `api.`, `admin.`, `www.imperiodebolso.com.br`.

Nada é implantado sem autorização do titular.
