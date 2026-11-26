-- ADR 0035: evolução por mapa, ajudantes com nível, estrelas de evolução e temporadas.
-- Nada é zerado: quem já joga mantém negócios, níveis, moedas e mapas abertos.

-- Nível do ajudante (0 = sem ajudante, 1 = contratado … 10). Quem já tem ajudante começa no 1.
ALTER TABLE "player_businesses" ADD COLUMN "manager_level" INTEGER NOT NULL DEFAULT 0;
UPDATE "player_businesses" SET "manager_level" = 1 WHERE "manager_unlocked";

-- Mapas liberados (quantos, na ordem). NULL = jogador antigo: na primeira abertura o servidor
-- grava o que ele já tinha aberto pela regra antiga (mapa aberto continua aberto). Novos = 1.
ALTER TABLE "players" ADD COLUMN "unlocked_maps" INTEGER;
ALTER TABLE "players" ALTER COLUMN "unlocked_maps" SET DEFAULT 1;

-- Estrelas de evolução acumuladas (1 por evolução de cada negócio). NULL = ainda não contadas:
-- o servidor soma as evoluções atuais na primeira abertura.
ALTER TABLE "players" ADD COLUMN "evo_stars" INTEGER;
-- Última temporada já conferida para prêmios.
ALTER TABLE "players" ADD COLUMN "rewards_checked_season" INTEGER;

-- Temporada de 20 dias: estrelas de evolução ganhas na temporada (o faturamento vem do ledger).
CREATE TABLE "player_seasons" (
    "player_id" UUID NOT NULL,
    "season" INTEGER NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "player_seasons_pkey" PRIMARY KEY ("player_id","season")
);
CREATE INDEX "player_seasons_season_stars_idx" ON "player_seasons"("season", "stars");
ALTER TABLE "player_seasons" ADD CONSTRAINT "player_seasons_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Convide amigos: quem convidou este jogador e quando o convite já rendeu prêmio a quem convidou.
ALTER TABLE "players" ADD COLUMN "invited_by" UUID;
ALTER TABLE "players" ADD COLUMN "invite_rewarded_at" TIMESTAMPTZ(3);
CREATE INDEX "players_invited_by_idx" ON "players"("invited_by");
