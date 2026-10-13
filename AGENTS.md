# AGENTS.md — Império de Bolso

Guia para qualquer agente (Claude Code, Codex etc.) ou pessoa que trabalhe neste repositório.
Fonte de verdade do produto: [docs/README.md](docs/README.md). Plano de lojas/infra:
[docs/PLANO_PUBLICACAO_INFRA_MONETIZACAO.md](docs/PLANO_PUBLICACAO_INFRA_MONETIZACAO.md).
Arte: [docs/GUIA_ARTE_HIGGSFIELD.md](docs/GUIA_ARTE_HIGGSFIELD.md).

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `game/` | Godot 4.7 + GDScript. Jogo 2D isométrico, retrato 720×1280. |
| `backend/` | Node.js 22+ / TypeScript / Fastify / Prisma 7 / PostgreSQL. Autoridade econômica. |
| `shared/contracts/` | Contrato da API v1 (fonte para cliente e servidor). |
| `infrastructure/` | Docker Compose local; notas de deploy Dockploy. |
| `tools/art/` | Geração (API Higgsfield) e tratamento de arte para o Godot. |
| `docs/` | Documentação, backlog, status, ADRs, checklists. |
| `.github/workflows/` | CI (testes do backend e do jogo). |

`admin/` (React) e `landing/` (Next.js) ainda não existem — entram nas etapas 3 e de publicação.

## Regras inegociáveis

1. **Servidor é a autoridade.** Saldo, tempo, produção, missões, compras e ranking são decididos
   na API. O cliente nunca envia saldo, horário ou tempo decorrido.
2. **Dinheiro virtual em BIGINT** no banco e **string** no JSON. Nunca usar float para saldo.
3. **Todo comando econômico** passa por `runIdempotentCommand` (backend/src/lib/idempotency.ts):
   trava a carteira (`SELECT … FOR UPDATE`), exige `Idempotency-Key`, grava ledger.
4. **Sem segredos no Git.** Use `.env` (ignorado) e `.env.example`. Keystores, certificados e
   chaves ficam fora do repositório.
5. **Sem anúncios/pagamentos reais** sem aprovação explícita do titular. Começar por mocks/sandbox.
6. **Não alegar** que compilou/testou sem ter rodado os comandos. Reportar o que ficou sem validar.
7. **Placeholders são placeholders.** Arte provisória é marcada como tal; não apresentar como final.
8. **Godot é o motor.** Não trocar de tecnologia. Swift/Kotlin só para plugins nativos.
9. Git: `main` (produção), `develop` (integração), `feature/*`. Nada de branch permanente de
   servidor. Não fazer push/deploy sem autorização.

## Comandos

```bash
# Banco local (PostgreSQL 17 na porta 55432)
docker compose -f infrastructure/docker-compose.yml up -d postgres

# Backend
cd backend
cp .env.example .env            # e gere um JWT_SECRET
npm install
npm run db:deploy && npm run db:seed
npm run dev                     # http://127.0.0.1:3000
npm test                        # usa TEST_DATABASE_URL (banco imperio_test)
npm run typecheck && npm run format:check

# Jogo
godot --headless --path game --import
godot --headless --path game res://tests/test_runner.tscn                    # unitários
IMPERIO_TEST_API=1 godot --headless --path game res://tests/test_runner.tscn # + integração (API no ar)
godot --path game                                                            # abre o jogo
```

`godot` = `/Applications/Godot.app/Contents/MacOS/Godot` (alias configurado no `~/.zshrc`).

Arte (Higgsfield → Godot): ver [tools/art/README.md](tools/art/README.md). Nunca gerar sem
autorização de custo do titular; a chave `HF_KEY` fica só no `.env`.

## Ao terminar cada entrega

- Atualize [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) (entregue, testes
  rodados, bloqueios, próxima etapa) e o [docs/BACKLOG.md](docs/BACKLOG.md).
- Decisão de arquitetura nova → ADR em `docs/ADRs/` + linha em [docs/DECISOES.md](docs/DECISOES.md).
- Dúvida não bloqueante → [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md).
- Mudou a API → atualize [shared/contracts/api-v1.md](shared/contracts/api-v1.md) e os testes.

## Convenções

- Textos de interface em pt-BR, via `tr()` no Godot (pronto para i18n).
- Códigos de erro da API são estáveis (`INSUFFICIENT_FUNDS` …); o cliente traduz pelo código.
- Toque mínimo de 88 px na resolução base (~48 dp).
- Backend: Prettier (largura 100), TypeScript estrito, testes Vitest contra PostgreSQL real.
- GDScript: tipagem estática; scripts utilitários carregados com `preload` (sem `class_name`
  global, para os testes rodarem sem cache do editor).
