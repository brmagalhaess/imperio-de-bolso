import type { Db, Tx } from "../db/prisma.js";
import { AppError, Errors } from "../errors.js";
import { profitPerCycle } from "../economy/formulas.js";
import { STORE_ITEMS, storeItem } from "../economy/store.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { track } from "./analytics.js";
import { vipUntil } from "./entitlements.js";
import { getPlayerState } from "./game.js";
import { applyCoins, applyGems } from "./wallet.js";

// Loja (ADR 0008): itens comprados com diamantes e vitrine dos itens de dinheiro real/anúncio.

type Reader = Db | Tx;

/** Produção de `seconds` dos negócios do jogador num mapa (turbo e anúncio de bônus). */
export async function productionFor(
  db: Reader,
  playerId: string,
  district: string,
  seconds: number,
): Promise<bigint> {
  const owned = await db.playerBusiness.findMany({
    where: { playerId, business: { district } },
    include: { business: true },
  });
  return owned.reduce(
    (sum, pb) =>
      sum +
      profitPerCycle(pb.business, pb.level) *
        BigInt(Math.floor(seconds / pb.business.cycleSeconds)),
    0n,
  );
}

export async function getCatalog(db: Db, playerId: string, now: Date, storeMode: string) {
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
  return {
    sandbox: storeMode === "mock",
    items: STORE_ITEMS.map((i) => ({
      ...i,
      ...("gems" in i ? { gems: i.gems.toString() } : {}),
      ...("costGems" in i ? { costGems: i.costGems.toString() } : {}),
    })),
    entitlements: {
      autoCollectUntil:
        player.autoCollectUntil && player.autoCollectUntil > now
          ? player.autoCollectUntil.toISOString()
          : null,
      vipUntil: (await vipUntil(db, playerId, now))?.toISOString() ?? null,
    },
    serverTime: now.toISOString(),
  };
}

/** Compra com diamantes: auto-coleta (soma tempo à validade) ou turbo de produção do mapa. */
export function buyWithGems(itemId: string, district: string | undefined, now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const item = storeItem(itemId);
    if (!item || (item.kind !== "auto_collect" && item.kind !== "boost")) {
      throw Errors.storeItemNotFound(itemId);
    }
    let w = await applyGems(tx, wallet, -item.costGems, `store:${item.id}`, idempotencyKey, now);
    const body: Record<string, unknown> = { bought: item.id };

    if (item.kind === "auto_collect") {
      const player = await tx.player.findUniqueOrThrow({ where: { id: wallet.playerId } });
      const from =
        player.autoCollectUntil && player.autoCollectUntil > now ? player.autoCollectUntil : now;
      const until = new Date(from.getTime() + item.hours * 3_600_000);
      await tx.player.update({ where: { id: wallet.playerId }, data: { autoCollectUntil: until } });
      body.autoCollectUntil = until.toISOString();
    } else {
      if (!district) throw new AppError(400, "DISTRICT_REQUIRED", "Informe o mapa do turbo");
      const amount = await productionFor(tx, wallet.playerId, district, item.hours * 3600);
      if (amount === 0n)
        throw new AppError(409, "NOTHING_TO_BOOST", "Construa um negócio neste mapa primeiro");
      w = await applyCoins(tx, w, amount, `boost:${item.id}`, `${idempotencyKey}:coins`, now);
      body.coins = amount.toString();
      body.district = district;
    }
    await track(tx, wallet.playerId, "store_gems_spent", { item: item.id });
    return {
      statusCode: 200,
      body: { ...body, state: await getPlayerState(tx, wallet.playerId, now) },
    };
  };
}
