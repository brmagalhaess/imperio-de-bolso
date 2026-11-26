-- Ligas por número de vendas do império (ADR 0026): grupo congelado na semana.
ALTER TABLE "player_league_weeks" ADD COLUMN "bracket" INTEGER NOT NULL DEFAULT 0;
DROP INDEX IF EXISTS "player_league_weeks_week_league_idx";
CREATE INDEX "player_league_weeks_week_bracket_league_idx" ON "player_league_weeks"("week", "bracket", "league");
-- Bônus do pódio que muda a cada semana (Turbo, auto-coleta, coleta antecipada).
ALTER TABLE "player_weekly_rewards" ADD COLUMN "bonus_kind" TEXT,
ADD COLUMN "bonus_hours" INTEGER NOT NULL DEFAULT 0;
