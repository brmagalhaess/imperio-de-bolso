-- Dinheiro sem teto (ADR 0033): moedas passam de BIGINT (até 9,2×10^18) para NUMERIC(65,0).
-- O schema.prisma continua declarando BigInt: o Prisma lê e grava bigint do JavaScript, e o
-- banco guarda qualquer tamanho. NÃO usar `prisma migrate dev` (ele "corrigiria" de volta);
-- migrações novas são escritas à mão (ver AGENTS.md).
ALTER TABLE "player_wallets" ALTER COLUMN "coins" TYPE NUMERIC(65,0);
ALTER TABLE "wallet_ledger" ALTER COLUMN "delta" TYPE NUMERIC(65,0),
  ALTER COLUMN "balance_after" TYPE NUMERIC(65,0);
ALTER TABLE "business_definitions" ALTER COLUMN "cost" TYPE NUMERIC(65,0),
  ALTER COLUMN "revenue" TYPE NUMERIC(65,0),
  ALTER COLUMN "operating_cost" TYPE NUMERIC(65,0),
  ALTER COLUMN "manager_cost" TYPE NUMERIC(65,0);
ALTER TABLE "player_missions" ALTER COLUMN "target" TYPE NUMERIC(65,0),
  ALTER COLUMN "progress" TYPE NUMERIC(65,0),
  ALTER COLUMN "reward_coins" TYPE NUMERIC(65,0);
ALTER TABLE "ad_rewards" ALTER COLUMN "reward_coins" TYPE NUMERIC(65,0);
ALTER TABLE "player_events" ALTER COLUMN "target" TYPE NUMERIC(65,0);
ALTER TABLE "players" ALTER COLUMN "last_afk_total" TYPE NUMERIC(65,0);
