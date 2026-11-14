-- ADR 0006: produção AFK por mapa e auto-coleta como item da Loja.
ALTER TABLE "players" ADD COLUMN "current_district" TEXT;
ALTER TABLE "players" ADD COLUMN "last_seen_at" TIMESTAMPTZ(3);
ALTER TABLE "players" ADD COLUMN "auto_collect" BOOLEAN NOT NULL DEFAULT false;

-- Negócios com ajudante voltam ao modo manual: a partir de agora a produção automática
-- só corre enquanto o jogador está fora do mapa (convertida pelo POST /presence).
UPDATE "player_businesses" SET "cycle_started_at" = now() - make_interval(secs => "carry_ms" / 1000.0), "carry_ms" = 0
WHERE "manager_unlocked" AND "cycle_started_at" IS NULL;
