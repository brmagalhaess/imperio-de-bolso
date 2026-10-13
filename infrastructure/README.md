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
- Painel admin em container: `http://localhost:8080` (nginx; repassa `/api` para a API). Exige
  `ADMIN_TOKEN` exportado antes do `up` (`export ADMIN_TOKEN=$(openssl rand -hex 32)`); vazio
  deixa o painel desligado.

## Staging e produção (Dockploy)

Stack: `infrastructure/docker-compose.prod.yml` (postgres sem porta pública, api, admin e
backup). Uma stack por ambiente (`STACK_ENV=staging|production`), cada uma com banco, volumes e
segredos próprios. Variáveis: `infrastructure/prod.env.example`.

Passo a passo no Dockploy (precisa do acesso do titular à VPS):
1. Criar projeto → "Compose" → repositório do GitHub, caminho `infrastructure/docker-compose.prod.yml`.
2. Aba Environment: preencher as variáveis do `prod.env.example` com valores gerados por
   `openssl rand -hex 32`. Guardar `BACKUP_PASSPHRASE` também fora do servidor.
3. Domínios (Traefik, HTTPS Let's Encrypt): `api.<domínio>` → serviço `api` porta 3000;
   `admin.<domínio>` → serviço `admin` porta 80 (opcional; restringir por IP se possível).
4. Deploy. A API aplica migrações e o catálogo ao subir; conferir `https://api.<domínio>/health`.
5. Apontar o jogo para a API: `api/base_url.android` em `game/project.godot` (HTTPS).

Teste fechado antes das integrações reais de Billing/AdMob (ADR 0008): a stack de staging usa
`STORE_MODE=mock`, `ADS_MODE=mock` e `BETA_SANDBOX=true` — nada é cobrado. A API só aceita mock
em `NODE_ENV=production` com esse sinal explícito. Produção pública: `BETA_SANDBOX=false`.

Segurança já aplicada na API: cabeçalhos (helmet), limite de requisições por IP (geral e mais
estrito em `/auth/guest`), corpo máximo de 16 KB, logs sem corpo/query/Authorization,
`TRUST_PROXY=true` atrás do Traefik, JWT de exemplo e mock recusados em produção.

## Backups (plano §24)

O serviço `backup` faz `pg_dump` diário (`BACKUP_CRON`, padrão 03:30 UTC), criptografado com
AES-256 (`BACKUP_PASSPHRASE`), mantendo os `BACKUP_KEEP` mais recentes no volume `backups`.
Recomendado: copiar o volume para fora da VPS (ex.: backup de volume do Dockploy para S3).

```bash
# Backup agora / listar
docker compose -f infrastructure/docker-compose.prod.yml exec backup backup.sh
docker compose -f infrastructure/docker-compose.prod.yml exec backup ls -lh /backups
# Teste de restauração num banco descartável (compara contagens e saldo total)
docker compose -f infrastructure/docker-compose.prod.yml exec postgres createdb -U imperio restore_check
docker compose -f infrastructure/docker-compose.prod.yml exec -e SCRATCH_DATABASE_URL=postgresql://imperio:$POSTGRES_PASSWORD@postgres:5432/restore_check backup verify-restore.sh
# Restauração real (SUBSTITUI o banco; pare a API antes)
docker compose -f infrastructure/docker-compose.prod.yml exec backup restore.sh /backups/<arquivo>.dump.enc "$DATABASE_URL"
```

Testado localmente em 2026-10-13: backup → restauração → contagens e saldo idênticos; senha
errada falha sem tocar no banco; rotação mantém só os N mais recentes.

Nada é implantado sem autorização do titular.
