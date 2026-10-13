import "dotenv/config";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createPrisma, type Db } from "../src/db/prisma.js";
import { seedCatalog } from "../src/db/seed.js";

export const ADMIN_TOKEN = "token-de-admin-de-teste-com-mais-de-32-caracteres";

export interface TestContext {
  app: FastifyInstance;
  db: Db;
  clock: { now: Date; advance(seconds: number): void };
  close(): Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL não definido");
  const config = loadConfig({
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: url,
    JWT_SECRET: "segredo-de-teste-com-mais-de-32-caracteres!!",
    ADMIN_TOKEN: ADMIN_TOKEN,
  });
  const db = createPrisma(url);
  await db.$executeRawUnsafe(
    `TRUNCATE players, player_wallets, wallet_ledger, player_businesses, idempotency_records,
              business_definitions, player_missions, player_achievements, analytics_events
     RESTART IDENTITY CASCADE`,
  );
  await seedCatalog(db);

  const clock = {
    now: new Date("2026-01-01T12:00:00.000Z"),
    advance(seconds: number) {
      this.now = new Date(this.now.getTime() + seconds * 1000);
    },
  };
  const app = await buildApp({ config, db, now: () => clock.now });
  return {
    app,
    db,
    clock,
    async close() {
      await app.close();
      await db.$disconnect();
    },
  };
}

export interface Guest {
  playerId: string;
  guestId: string;
  guestSecret: string;
  token: string;
}

export async function newGuest(app: FastifyInstance): Promise<Guest> {
  const res = await app.inject({ method: "POST", url: "/api/v1/auth/guest" });
  if (res.statusCode !== 201) throw new Error(`guest falhou: ${res.body}`);
  const body = res.json();
  return {
    playerId: body.playerId,
    guestId: body.guestId,
    guestSecret: body.guestSecret,
    token: body.accessToken,
  };
}

export function key(): string {
  return randomUUID();
}

export function post(
  app: FastifyInstance,
  guest: Guest,
  url: string,
  payload: unknown,
  idempotencyKey: string | null = key(),
) {
  return app.inject({
    method: "POST",
    url: `/api/v1${url}`,
    headers: {
      authorization: `Bearer ${guest.token}`,
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    payload: payload as object,
  });
}

export function get(app: FastifyInstance, guest: Guest, url: string) {
  return app.inject({
    method: "GET",
    url: `/api/v1${url}`,
    headers: { authorization: `Bearer ${guest.token}` },
  });
}

export async function coinsOf(db: Db, playerId: string): Promise<bigint> {
  const wallet = await db.playerWallet.findUniqueOrThrow({ where: { playerId } });
  return wallet.coins;
}

export async function setCoins(db: Db, playerId: string, coins: bigint): Promise<void> {
  await db.playerWallet.update({ where: { playerId }, data: { coins } });
}
