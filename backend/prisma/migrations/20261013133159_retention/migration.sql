-- CreateTable
CREATE TABLE "player_missions" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "day" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "target" BIGINT NOT NULL,
    "progress" BIGINT NOT NULL DEFAULT 0,
    "reward_coins" BIGINT NOT NULL,
    "reward_gems" INTEGER NOT NULL,
    "claimed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_achievements" (
    "player_id" UUID NOT NULL,
    "achievement_id" TEXT NOT NULL,
    "unlocked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMPTZ(3),

    CONSTRAINT "player_achievements_pkey" PRIMARY KEY ("player_id","achievement_id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "player_id" UUID,
    "name" TEXT NOT NULL,
    "props" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_missions_player_id_day_idx" ON "player_missions"("player_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "player_missions_player_id_day_template_key" ON "player_missions"("player_id", "day", "template");

-- CreateIndex
CREATE INDEX "analytics_events_name_created_at_idx" ON "analytics_events"("name", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_player_id_created_at_idx" ON "analytics_events"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_ledger_reason_created_at_idx" ON "wallet_ledger"("reason", "created_at");

-- AddForeignKey
ALTER TABLE "player_missions" ADD CONSTRAINT "player_missions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Barreiras no banco: progresso e prêmios não negativos.
ALTER TABLE "player_missions" ADD CONSTRAINT "player_missions_values_valid"
  CHECK ("target" > 0 AND "progress" >= 0 AND "reward_coins" >= 0 AND "reward_gems" >= 0);
