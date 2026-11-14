-- AlterTable
ALTER TABLE "players" ADD COLUMN     "rewards_checked_week" TEXT;

-- CreateTable
CREATE TABLE "player_weekly_rewards" (
    "player_id" UUID NOT NULL,
    "week" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "league" INTEGER,
    "gems" INTEGER NOT NULL,
    "claimed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_weekly_rewards_pkey" PRIMARY KEY ("player_id","week","kind")
);

-- AddForeignKey
ALTER TABLE "player_weekly_rewards" ADD CONSTRAINT "player_weekly_rewards_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

