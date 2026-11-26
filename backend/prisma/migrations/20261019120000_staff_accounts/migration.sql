-- Conta da equipe fora do ranking (pedido do titular, 2026-10-19).
ALTER TABLE "players" ADD COLUMN "is_staff" BOOLEAN NOT NULL DEFAULT false;
