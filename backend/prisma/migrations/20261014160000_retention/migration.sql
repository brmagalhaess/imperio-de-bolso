-- AlterTable
ALTER TABLE "players" ADD COLUMN     "last_login_reward_day" TEXT,
ADD COLUMN     "login_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mission_chest_day" TEXT;

-- CreateTable
CREATE TABLE "player_league_weeks" (
    "player_id" UUID NOT NULL,
    "week" TEXT NOT NULL,
    "league" INTEGER NOT NULL,

    CONSTRAINT "player_league_weeks_pkey" PRIMARY KEY ("player_id","week")
);

-- CreateTable
CREATE TABLE "player_events" (
    "player_id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "target" BIGINT NOT NULL,
    "claimed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_events_pkey" PRIMARY KEY ("player_id","event_id")
);

-- CreateIndex
CREATE INDEX "player_league_weeks_week_league_idx" ON "player_league_weeks"("week", "league");

-- AddForeignKey
ALTER TABLE "player_league_weeks" ADD CONSTRAINT "player_league_weeks_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_events" ADD CONSTRAINT "player_events_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

