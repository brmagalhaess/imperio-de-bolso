import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Db } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { track } from "./analytics.js";

// Conta convidada: o servidor gera guestId + segredo de alta entropia, devolvidos
// uma única vez; o cliente guarda os dois e troca por JWT curto a cada sessão.
// Guardamos só o SHA-256 do segredo (entropia de 256 bits dispensa hash lento).

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export interface GuestSession {
  playerId: string;
  guestId: string;
  guestSecret?: string;
  created: boolean;
}

export async function createGuest(db: Db, startingCoins: bigint): Promise<GuestSession> {
  const guestId = randomUUID();
  const guestSecret = randomBytes(32).toString("base64url");
  const displayName = `Empreendedor ${randomInt(1000, 10000)}`;

  const player = await db.$transaction(async (tx) => {
    const created = await tx.player.create({
      data: {
        guestId,
        guestSecretHash: hashSecret(guestSecret),
        displayName,
        wallet: { create: { coins: startingCoins } },
      },
    });
    await tx.walletLedger.create({
      data: {
        playerId: created.id,
        currency: "COINS",
        delta: startingCoins,
        balanceAfter: startingCoins,
        reason: "initial_grant",
        idempotencyKey: `${created.id}:initial_grant`,
      },
    });
    await track(tx, created.id, "player_created");
    return created;
  });

  return { playerId: player.id, guestId, guestSecret, created: true };
}

export async function resumeGuest(
  db: Db,
  guestId: string,
  guestSecret: string,
): Promise<GuestSession> {
  const player = await db.player.findUnique({ where: { guestId } });
  const expected = Buffer.from(player?.guestSecretHash ?? "0".repeat(64), "hex");
  const actual = Buffer.from(hashSecret(guestSecret), "hex");
  if (!player || !timingSafeEqual(expected, actual)) throw Errors.invalidGuestCredentials();
  return { playerId: player.id, guestId, created: false };
}
