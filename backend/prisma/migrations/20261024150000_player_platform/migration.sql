-- Plataforma e versão do jogo de cada jogador (painel admin: de qual loja vêm os jogadores).
ALTER TABLE "players" ADD COLUMN "platform" TEXT;
ALTER TABLE "players" ADD COLUMN "app_version" TEXT;

-- Quem já se identificou fica com a plataforma conhecida: vínculo Apple ou compra na App Store
-- = iPhone; vínculo Google ou compra no Google Play = Android. Os outros entram ao abrir o jogo.
UPDATE "players" p SET "platform" = 'ios'
WHERE EXISTS (SELECT 1 FROM "player_identities" i WHERE i.player_id = p.id AND i.provider = 'apple')
   OR EXISTS (SELECT 1 FROM "purchase_receipts" r WHERE r.player_id = p.id AND r.store = 'apple');
UPDATE "players" p SET "platform" = 'android'
WHERE p."platform" IS NULL AND (
      EXISTS (SELECT 1 FROM "player_identities" i WHERE i.player_id = p.id AND i.provider = 'google')
   OR EXISTS (SELECT 1 FROM "purchase_receipts" r WHERE r.player_id = p.id AND r.store = 'google'));
