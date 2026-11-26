-- AlterTable
ALTER TABLE "players" ADD COLUMN     "turbo_from" TIMESTAMPTZ(3),
ADD COLUMN     "turbo_until" TIMESTAMPTZ(3);

