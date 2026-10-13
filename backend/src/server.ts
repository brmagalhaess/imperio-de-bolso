import "dotenv/config";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPrisma } from "./db/prisma.js";

const config = loadConfig();
const db = createPrisma(config.DATABASE_URL);
const app = await buildApp({ config, db, logger: true });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "encerrando");
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.HOST, port: config.PORT });
