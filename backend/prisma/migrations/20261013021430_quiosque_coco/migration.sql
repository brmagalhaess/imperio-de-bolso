-- Direção visual v2: o 4º negócio da ilha da praia é o Quiosque de Coco.
-- Renomeia mantendo id e posses dos jogadores.
UPDATE "business_definitions" SET "slug" = 'quiosque_coco', "name" = 'Quiosque de Coco' WHERE "slug" = 'lanchonete';
