# ADR 0033 — Dinheiro sem teto (NUMERIC no banco, texto exato no jogo)

Data: 2026-10-25 · Status: aceita

## Contexto
Os saldos chegavam perto do limite do BIGINT do PostgreSQL (9,2×10^18) com os mapas finais, e os
12 mapas novos (ADR 0034) levam os custos a 10^22 e o nível 100 a ~10^29.

## Decisão
- Colunas de dinheiro passam a `NUMERIC(65,0)` (migração `20261025120000_big_money`, escrita à
  mão): carteira, ledger, custos/receitas do catálogo, missões, anúncios, eventos e AFK.
  O `schema.prisma` continua com `BigInt` (o Prisma lê e grava bigint nessas colunas).
- Consultas diretas (`$queryRaw`) devolvem `Decimal`: sempre passam por `toBig()`
  (`backend/src/lib/big.ts`). Nada de `::bigint` nas somas.
- Teto de moedas e de valores da economia: 10^60.
- Jogo: `scripts/big.gd` faz soma, subtração, comparação e multiplicação por inteiro em texto
  (blocos de 10^9). Float só para barras e proporções.
- Nunca rodar `prisma migrate dev` (recriaria as colunas como BIGINT); migrações à mão.

## Consequências
Sem limite prático de saldo. As versões antigas do jogo leem o saldo com `int()`, que estoura
acima de 9,2×10^18 — só afeta quem passar disso antes de atualizar.
