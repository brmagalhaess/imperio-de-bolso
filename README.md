# Império de Bolso

Jogo mobile **idle tycoon isométrico 2D** (Android primeiro, iOS depois). O jogador começa com
100 moedas virtuais, compra e melhora negócios e coleta a produção. Moedas não têm valor real.

- **Documentação do produto:** [docs/README.md](docs/README.md)
- **Status atual:** [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md)
- **Backlog:** [docs/BACKLOG.md](docs/BACKLOG.md)
- **Regras para quem desenvolve (pessoas e agentes):** [AGENTS.md](AGENTS.md)
- **Contrato da API:** [shared/contracts/api-v1.md](shared/contracts/api-v1.md)
- **Setup da máquina:** [docs/SETUP.md](docs/SETUP.md)

## Rodar localmente

```bash
docker compose -f infrastructure/docker-compose.yml up -d postgres
cd backend && cp .env.example .env && npm install && npm run db:deploy && npm run db:seed && npm run dev
# em outro terminal
godot --path game
```

Detalhes e testes em [AGENTS.md](AGENTS.md).

## Estrutura

`game/` Godot 4.7 · `backend/` API Node/TypeScript/Prisma/PostgreSQL · `shared/contracts/` ·
`infrastructure/` · `docs/` · `.github/workflows/`
