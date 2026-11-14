-- Compras de teste separadas das reais (painel admin não conta as de teste).
ALTER TABLE "purchase_receipts" ADD COLUMN "test" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN "test" BOOLEAN NOT NULL DEFAULT false;

-- Antes desta coluna o ambiente da loja não era guardado: marca como teste o que é da loja
-- "mock" e tudo das contas da equipe (o iPhone de desenvolvimento compra no Sandbox da Apple).
UPDATE "purchase_receipts" r SET "test" = true
WHERE r.store = 'mock' OR EXISTS (SELECT 1 FROM "players" p WHERE p.id = r.player_id AND p.is_staff);
UPDATE "subscriptions" s SET "test" = true
WHERE s.store = 'mock' OR EXISTS (SELECT 1 FROM "players" p WHERE p.id = s.player_id AND p.is_staff);
