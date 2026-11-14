import "dotenv/config";
import { BUSINESS_CATALOG } from "../economy/catalog.js";
import { createPrisma, type Db } from "./prisma.js";

/** Insere/atualiza o catálogo de negócios. Idempotente. */
export async function seedCatalog(db: Db): Promise<void> {
  for (const b of BUSINESS_CATALOG) {
    await db.businessDefinition.upsert({
      where: { slug: b.slug },
      create: b,
      update: b,
    });
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definido");
  const db = createPrisma(url);
  await seedCatalog(db);
  console.log(`Catálogo: ${BUSINESS_CATALOG.length} negócios gravados.`);
  await db.$disconnect();
}
