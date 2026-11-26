-- AlterTable
ALTER TABLE "business_definitions" ADD COLUMN     "district" TEXT NOT NULL DEFAULT 'praia';

-- Negócios da cidade (o seed também grava, mas a migração deixa o banco correto sozinha).
UPDATE "business_definitions" SET "district" = 'cidade'
WHERE "slug" IN ('mercadinho', 'restaurante', 'supermercado', 'academia', 'hotel', 'shopping');
