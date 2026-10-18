-- Dobro de moedas (ADR 0025): toda a produção ×2 de double_from até double_until.
ALTER TABLE "players" ADD COLUMN     "double_from" TIMESTAMPTZ(3),
ADD COLUMN     "double_until" TIMESTAMPTZ(3);
