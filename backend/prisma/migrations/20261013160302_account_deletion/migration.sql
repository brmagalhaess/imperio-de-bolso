-- DropForeignKey
ALTER TABLE "purchase_receipts" DROP CONSTRAINT "purchase_receipts_player_id_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_player_id_fkey";

-- AlterTable
ALTER TABLE "purchase_receipts" ALTER COLUMN "player_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "player_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

