// Vitrine dos pacotes promocionais e entrega do conteúdo (ADR 0024).

import type { Db, Tx } from "../db/prisma.js";
import { BUNDLES, type Bundle, holidayBundleFor, weeklyBundles } from "../economy/bundles.js";
import type { LockedWallet } from "./wallet.js";
import { weekBounds } from "../lib/time.js";
import { productionFor } from "./store.js";
import { applyCoins, applyGems } from "./wallet.js";

type Reader = Db | Tx;

export interface Offer {
  id: string;
  productId: string;
  title: string;
  priceBRL: string;
  icon: string;
  kind: Bundle["kind"];
  gems: string;
  autoCollectHours: number;
  turboHours: number;
  boostHours: number;
  /** Fim da vitrine (ISO); o Kit Iniciante não expira. */
  endsAt: string | null;
}

function offer(x: Bundle, endsAt: Date | null): Offer {
  return {
    id: x.id,
    productId: x.productId,
    title: x.title,
    priceBRL: x.priceBRL,
    icon: x.icon,
    kind: x.kind,
    gems: x.gems.toString(),
    autoCollectHours: x.autoCollectHours,
    turboHours: x.turboHours,
    boostHours: x.boostHours,
    endsAt: endsAt ? endsAt.toISOString() : null,
  };
}

/**
 * Até 5 ofertas: feriado (se houver) + 3 da semana + Kit Iniciante (se nunca comprou). Some da
 * vitrine o que o jogador já comprou nesta semana (limite de 1 por vitrine).
 */
export async function offersFor(db: Reader, playerId: string, now: Date): Promise<Offer[]> {
  const week = weekBounds(now);
  const receipts = await db.purchaseReceipt.findMany({
    where: { playerId, productId: { in: BUNDLES.map((x) => x.productId) } },
    select: { productId: true, createdAt: true },
  });
  const boughtThisWeek = new Set(
    receipts.filter((r) => r.createdAt >= week.start).map((r) => r.productId),
  );
  const boughtEver = new Set(receipts.map((r) => r.productId));

  const list: Offer[] = [];
  const holiday = holidayBundleFor(now);
  if (holiday && !boughtThisWeek.has(holiday.bundle.productId)) {
    list.push(offer(holiday.bundle, holiday.end));
  }
  for (const x of weeklyBundles(now)) {
    if (!boughtThisWeek.has(x.productId)) list.push(offer(x, week.end));
  }
  const starter = BUNDLES.find((x) => x.kind === "starter")!;
  if (!boughtEver.has(starter.productId)) list.push(offer(starter, null));
  return list.slice(0, 5);
}

/**
 * Entrega o pacote pago. O pagamento já aconteceu na loja, então entrega sempre (mesmo se a
 * vitrine virou entre ver e pagar); o recibo único impede repetir. Coleta antecipada usa o mapa
 * informado ou, sem ele, o mapa onde o jogador mais produz.
 */
export async function grantBundle(
  tx: Tx,
  wallet: LockedWallet,
  bundle: Bundle,
  district: string | undefined,
  idempotencyKey: string,
  now: Date,
): Promise<{ wallet: LockedWallet; coins: bigint }> {
  let w = wallet;
  if (bundle.gems > 0n) {
    w = await applyGems(tx, w, bundle.gems, `purchase:${bundle.id}`, idempotencyKey, now);
  }
  const player = await tx.player.findUniqueOrThrow({ where: { id: w.playerId } });
  const data: { autoCollectUntil?: Date; turboUntil?: Date; turboFrom?: Date | null } = {};
  if (bundle.autoCollectHours > 0) {
    const from =
      player.autoCollectUntil && player.autoCollectUntil > now ? player.autoCollectUntil : now;
    data.autoCollectUntil = new Date(from.getTime() + bundle.autoCollectHours * 3_600_000);
  }
  if (bundle.turboHours > 0) {
    const active = player.turboUntil && player.turboUntil > now;
    data.turboUntil = new Date(
      (active ? player.turboUntil!.getTime() : now.getTime()) + bundle.turboHours * 3_600_000,
    );
    data.turboFrom = active ? player.turboFrom : now;
  }
  if (Object.keys(data).length > 0) await tx.player.update({ where: { id: w.playerId }, data });

  let coins = 0n;
  if (bundle.boostHours > 0) {
    const districts = district
      ? [district]
      : [
          ...new Set(
            (
              await tx.playerBusiness.findMany({
                where: { playerId: w.playerId },
                select: { business: { select: { district: true } } },
              })
            ).map((pb) => pb.business.district),
          ),
        ];
    for (const d of districts) {
      const amount = await productionFor(tx, w.playerId, d, bundle.boostHours * 3600, now);
      if (amount > coins) coins = amount;
    }
    if (coins > 0n) {
      w = await applyCoins(tx, w, coins, `purchase:${bundle.id}`, `${idempotencyKey}:coins`, now);
    }
  }
  return { wallet: w, coins };
}
