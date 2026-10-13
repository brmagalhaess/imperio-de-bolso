-- AlterTable
ALTER TABLE "players" ADD COLUMN "auto_collect_until" TIMESTAMPTZ(3);
UPDATE "players" SET "auto_collect_until" = now() + interval '30 days' WHERE "auto_collect";
ALTER TABLE "players" DROP COLUMN "auto_collect",
ADD COLUMN     "last_afk_at" TIMESTAMPTZ(3),
ADD COLUMN     "last_afk_doubled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_afk_total" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "purchase_receipts" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "store" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "gems_granted" BIGINT NOT NULL DEFAULT 0,
    "revoke_shortfall" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "product_id" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_rewards" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "placement" TEXT NOT NULL,
    "district" TEXT,
    "reward_coins" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "transaction_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "verified_at" TIMESTAMPTZ(3),
    "claimed_at" TIMESTAMPTZ(3),

    CONSTRAINT "ad_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipts_store_transaction_id_key" ON "purchase_receipts"("store", "transaction_id");

-- CreateIndex
CREATE INDEX "subscriptions_player_id_expires_at_idx" ON "subscriptions"("player_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_store_transaction_id_key" ON "subscriptions"("store", "transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_rewards_transaction_id_key" ON "ad_rewards"("transaction_id");

-- CreateIndex
CREATE INDEX "ad_rewards_player_id_placement_created_at_idx" ON "ad_rewards"("player_id", "placement", "created_at");

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_rewards" ADD CONSTRAINT "ad_rewards_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Barreiras no banco.
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_status_valid" CHECK ("status" IN ('VERIFIED', 'REVOKED'));
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_status_valid" CHECK ("status" IN ('ACTIVE', 'REVOKED'));
ALTER TABLE "ad_rewards" ADD CONSTRAINT "ad_rewards_status_valid" CHECK ("status" IN ('PENDING', 'VERIFIED', 'CLAIMED', 'EXPIRED'));
