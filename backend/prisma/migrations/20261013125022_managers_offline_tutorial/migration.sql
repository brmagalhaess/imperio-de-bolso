-- Etapa 2: ajudantes (gerentes), produção offline e tutorial.

-- Sobra de tempo entre liquidações passa a ser em milissegundos (docs/README.md §7).
ALTER TABLE "player_businesses" RENAME COLUMN "carry_seconds" TO "carry_ms";
UPDATE "player_businesses" SET "carry_ms" = "carry_ms" * 1000;
ALTER TABLE "player_businesses" ADD CONSTRAINT "player_businesses_carry_nonnegative" CHECK ("carry_ms" >= 0);

-- Preço do ajudante por negócio (o seed grava os valores do catálogo).
ALTER TABLE "business_definitions" ADD COLUMN "manager_cost" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "business_definitions" ADD CONSTRAINT "business_definitions_manager_cost_nonnegative" CHECK ("manager_cost" >= 0);

-- Conclusão do tutorial (evento tutorial_completed — docs/README.md §13).
ALTER TABLE "players" ADD COLUMN "tutorial_completed_at" TIMESTAMPTZ(3);
