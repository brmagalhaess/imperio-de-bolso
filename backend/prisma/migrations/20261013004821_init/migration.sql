-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('COINS', 'GEMS');

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "guest_secret_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_wallets" (
    "player_id" UUID NOT NULL,
    "coins" BIGINT NOT NULL DEFAULT 0,
    "gems" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_wallets_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "wallet_ledger" (
    "id" BIGSERIAL NOT NULL,
    "player_id" UUID NOT NULL,
    "currency" "Currency" NOT NULL,
    "delta" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_definitions" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "cost" BIGINT NOT NULL,
    "revenue" BIGINT NOT NULL,
    "operating_cost" BIGINT NOT NULL DEFAULT 0,
    "cycle_seconds" INTEGER NOT NULL,
    "max_level" INTEGER NOT NULL DEFAULT 100,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "business_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_businesses" (
    "player_id" UUID NOT NULL,
    "business_id" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "manager_unlocked" BOOLEAN NOT NULL DEFAULT false,
    "cycle_started_at" TIMESTAMPTZ(3),
    "carry_seconds" INTEGER NOT NULL DEFAULT 0,
    "last_settlement_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_businesses_pkey" PRIMARY KEY ("player_id","business_id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "player_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("player_id","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_guest_id_key" ON "players"("guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_ledger_idempotency_key_key" ON "wallet_ledger"("idempotency_key");

-- CreateIndex
CREATE INDEX "wallet_ledger_player_id_created_at_idx" ON "wallet_ledger"("player_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "business_definitions_slug_key" ON "business_definitions"("slug");

-- AddForeignKey
ALTER TABLE "player_wallets" ADD CONSTRAINT "player_wallets_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_businesses" ADD CONSTRAINT "player_businesses_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_businesses" ADD CONSTRAINT "player_businesses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Barreiras no banco (além da validação na API): saldo nunca negativo,
-- nível sempre positivo, catálogo com valores válidos.
ALTER TABLE "player_wallets" ADD CONSTRAINT "player_wallets_coins_nonnegative" CHECK ("coins" >= 0);
ALTER TABLE "player_wallets" ADD CONSTRAINT "player_wallets_gems_nonnegative" CHECK ("gems" >= 0);
ALTER TABLE "player_businesses" ADD CONSTRAINT "player_businesses_level_positive" CHECK ("level" >= 1);
ALTER TABLE "business_definitions" ADD CONSTRAINT "business_definitions_values_valid"
  CHECK ("cost" > 0 AND "revenue" >= 0 AND "operating_cost" >= 0 AND "cycle_seconds" > 0 AND "max_level" >= 1);
