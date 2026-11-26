# ADR 0002 — Economia autoritativa no servidor

- **Status:** aceita · 2026-10-12

## Decisão

1. **Saldos BIGINT** (`player_wallets.coins/gems`) com `CHECK (coins >= 0)` no banco.
   No JSON, valores monetários trafegam como **string** (Godot e JS usam `double`).
2. **Uma ordem de lock por jogador:** todo comando econômico abre transação `READ COMMITTED`
   e faz `SELECT … FROM player_wallets … FOR UPDATE` antes de qualquer leitura de negócio.
   Isso serializa compras/upgrades/coletas simultâneas do mesmo jogador e evita deadlocks.
   A coluna `version` é incrementada a cada escrita (proteção extra contra uso sem lock).
3. **Ledger obrigatório** (`wallet_ledger`): cada mudança de saldo grava `delta`,
   `balance_after`, `reason` e `idempotency_key` único (`<player_id>:<chave>`).
4. **Idempotência:** comandos exigem `Idempotency-Key`. A resposta de sucesso é gravada em
   `idempotency_records (player_id, key)` na mesma transação. Reenvio → mesma resposta.
   Corpo diferente com a mesma chave → 422. Erros de domínio não são gravados (não mudam estado).
5. **Relógio do servidor** (`now()` injetável para testes). O cliente nunca envia horário;
   contagens no cliente usam relógio monotônico a partir de `secondsRemaining`.
6. Fórmulas (`backend/src/economy/formulas.ts`): upgrade `round(base × 1,15^(n−1))`,
   receita `round(base × 1,12^(n−1))`, lucro = receita − custo operacional (≥ 0).
   Nível máximo 100 mantém todos os valores abaixo de 2^53 (testado).

## Consequências

- Testes cobrem: saldo insuficiente, dupla compra, 10 compras simultâneas, 5 envios simultâneos
  com a mesma chave, coletas simultâneas, corpo com tempo forjado e CHECK no banco.
- Toda nova fonte de moedas (missões, anúncios, compras) deve usar `applyCoins` dentro de
  `runIdempotentCommand`.
