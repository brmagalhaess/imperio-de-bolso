# ADR 0001 — Monorepo e stack

- **Status:** aceita · 2026-10-12
- **Contexto:** a documentação define Godot 4/GDScript para o jogo, Node.js/TypeScript +
  PostgreSQL/Prisma para a API, React para admin, Docker/Dockploy para servidor, num monorepo.

## Decisão

- Monorepo `game/`, `backend/`, `shared/contracts/`, `infrastructure/`, `docs/`,
  `.github/workflows/`. `admin/` e `landing/` serão criados quando suas etapas começarem
  (evita pastas vazias).
- **Godot 4.7.2 estável**, renderer **GL Compatibility** (melhor alcance em aparelhos modestos),
  retrato 720×1280 com `stretch=canvas_items` e `aspect=expand`.
- **Node.js ≥ 22.12** (máquina atual: 22.14; Node 24 LTS recomendado quando atualizar),
  **Fastify 5**, **Zod 4** (validação), **Prisma 7.10** com `@prisma/adapter-pg`,
  **Vitest 5**, **TypeScript 7**, **Prettier**. ESLint fica para quando o time crescer.
- Prisma fixado em 7.x: a tag `latest` do npm aponta para 8.0.0-rc (não estável).
- PostgreSQL 17 no Docker; Redis não usado no MVP.
- Testes do backend rodam contra **PostgreSQL real** (banco `imperio_test`): concorrência e
  locks não podem ser testados com mocks.

## Consequências

- Uma única fonte de verdade de regras econômicas (backend). O jogo apenas exibe.
- CI baixa o binário oficial do Godot para rodar os testes do jogo em Linux.
