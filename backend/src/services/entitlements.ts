import type { Db, Tx } from "../db/prisma.js";

// Direitos comprados na Loja (ADR 0008): auto-coleta (diamantes, com validade) e Passe VIP.

type Reader = Db | Tx;

export async function vipUntil(db: Reader, playerId: string, now: Date): Promise<Date | null> {
  const sub = await db.subscription.findFirst({
    where: { playerId, status: "ACTIVE", expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" },
  });
  return sub?.expiresAt ?? null;
}

/** Auto-coleta no mapa aberto: comprada com diamantes (até a data) ou pelo Passe VIP. */
export async function autoCollectActive(
  db: Reader,
  player: { id: string; autoCollectUntil: Date | null },
  now: Date,
): Promise<boolean> {
  if (player.autoCollectUntil && player.autoCollectUntil > now) return true;
  return (await vipUntil(db, player.id, now)) !== null;
}
