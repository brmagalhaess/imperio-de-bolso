-- AlterTable
ALTER TABLE "players" ADD COLUMN     "last_prestige_at" TIMESTAMPTZ(3),
ADD COLUMN     "prestige_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prestige_stars" INTEGER NOT NULL DEFAULT 0;

