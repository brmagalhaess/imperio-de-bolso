import type { Db, Tx } from "../db/prisma.js";
import { AppError, Errors } from "../errors.js";
import { profitPerCycle } from "../economy/formulas.js";
import { STORE_ITEMS, VIP_DAILY_GEMS, storeItem } from "../economy/store.js";
import { dayBounds, gameDay } from "../lib/time.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { track } from "./analytics.js";
import { vipUntil } from "./entitlements.js";
import { getPlayerState, starsOf } from "./game.js";
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
  const [owned, stars] = await Promise.all([
    db.playerBusiness.findMany({
      where: { playerId, business: { district } },
      include: { business: true },
    }),
    starsOf(db, playerId),
  ]);
  return owned.reduce(
    (sum, pb) =>
      sum +
      profitPerCycle(pb.business, pb.level, stars) *
        BigInt(Math.floor(seconds / pb.business.cycleSeconds)),
    0n,
  );
}

/**
 * Catálogo + situação do jogador: estimativa de moedas da coleta antecipada no mapa informado,
 * uso de hoje do anúncio grátis (ex.: 1/5) e a recompensa diária do VIP.
 */
export async function getCatalog(
  db: Db,
  playerId: string,
  now: Date,
  storeMode: string,
  district = "praia",
) {
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
  const [vip, adsToday, vipClaim] = await Promise.all([
    vipUntil(db, playerId, now),
    db.adReward.count({
      where: {
        playerId,
        placement: "ad_boost",
        status: "CLAIMED",
        claimedAt: { gte: dayBounds(now).start },
      },
    }),
    db.vipDailyClaim.findUnique({ where: { playerId_day: { playerId, day: gameDay(now) } } }),
  ]);
  const items = await Promise.all(
    STORE_ITEMS.map(async (i) => {
      const seconds = i.kind === "boost" ? i.hours * 3600 : i.kind === "ad" ? i.minutes * 60 : 0;
      return {
        ...i,
        ...("gems" in i ? { gems: i.gems.toString() } : {}),
        ...("costGems" in i ? { costGems: i.costGems.toString() } : {}),
        ...(seconds > 0
          ? { estimateCoins: (await productionFor(db, playerId, district, seconds)).toString() }
          : {}),
        ...(i.kind === "ad" ? { usedToday: adsToday } : {}),
      };
    }),
  );
  return {
    sandbox: storeMode === "mock",
    district,
    items,
    entitlements: {
      autoCollectUntil:
        player.autoCollectUntil && player.autoCollectUntil > now
          ? player.autoCollectUntil.toISOString()
          : null,
      vipUntil: vip?.toISOString() ?? null,
      vipDailyGems: VIP_DAILY_GEMS,
      vipDailyClaimed: vipClaim !== null,
    },
    serverTime: now.toISOString(),
  };
}

/** Recompensa diária do Passe VIP: diamantes, uma vez por dia (Brasília). */
export function claimVipDaily(now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    if (!(await vipUntil(tx, wallet.playerId, now))) {
      throw new AppError(409, "VIP_REQUIRED", "Benefício exclusivo do Passe VIP");
    }
    const day = gameDay(now);
    const already = await tx.vipDailyClaim.findUnique({
      where: { playerId_day: { playerId: wallet.playerId, day } },
    });
    if (already) throw new AppError(409, "VIP_DAILY_CLAIMED", "Recompensa de hoje já resgatada");
    await tx.vipDailyClaim.create({
      data: { playerId: wallet.playerId, day, gems: VIP_DAILY_GEMS, claimedAt: now },
    });
    await applyGems(tx, wallet, BigInt(VIP_DAILY_GEMS), "vip_daily", idempotencyKey, now);
    await track(tx, wallet.playerId, "vip_daily_claimed");
    return {
      statusCode: 200,
      body: { gems: VIP_DAILY_GEMS, state: await getPlayerState(tx, wallet.playerId, now) },
    };
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
