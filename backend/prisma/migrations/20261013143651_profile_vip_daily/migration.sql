-- AlterTable
ALTER TABLE "players" ADD COLUMN     "name_changed_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "vip_daily_claims" (
    "player_id" UUID NOT NULL,
    "day" TEXT NOT NULL,
    "gems" INTEGER NOT NULL,
    "claimed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_daily_claims_pkey" PRIMARY KEY ("player_id","day")
);

-- AddForeignKey
ALTER TABLE "vip_daily_claims" ADD CONSTRAINT "vip_daily_claims_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Nomes escolhidos pelos jogadores são únicos (sem diferenciar maiúsculas). Os nomes
-- automáticos ("Empreendedor 1234") ficam de fora do índice.
CREATE UNIQUE INDEX "players_custom_name_unique" ON "players" (lower("display_name"))
  WHERE "name_changed_at" IS NOT NULL;
