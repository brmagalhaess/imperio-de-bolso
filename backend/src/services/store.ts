import type { Db, Tx } from "../db/prisma.js";
import { AppError, Errors } from "../errors.js";
import { profitPerCycle } from "../economy/formulas.js";
import { adsFor, purchasesFor } from "../lib/features.js";
import { AD_WINDOW_MS, STORE_ITEMS, VIP_DAILY_GEMS, storeItem } from "../economy/store.js";
import { gameDay, monthBounds } from "../lib/time.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { track } from "./analytics.js";
import { offersFor } from "./bundles.js";
import { vipUntil } from "./entitlements.js";
import { effectiveCycleMs, speedPercentAt } from "../economy/speed.js";
import { eventDistrict, getPlayerState, profitNow, speedContext, starsOf } from "./game.js";
import { applyCoins, applyGems } from "./wallet.js";

// Loja (ADR 0008): itens comprados com diamantes e vitrine dos itens de dinheiro real/anúncio.

type Reader = Db | Tx;

/** Produção de `seconds` dos negócios do jogador num mapa (turbo e anúncio de bônus). */
export async function productionFor(
  db: Reader,
  playerId: string,
  district: string,
  seconds: number,
  now: Date,
): Promise<bigint> {
  const [owned, stars, ctx, ev] = await Promise.all([
    db.playerBusiness.findMany({
      where: { playerId, business: { district } },
      include: { business: true },
    }),
    starsOf(db, playerId),
    speedContext(db, playerId, now),
    eventDistrict(db, playerId, now),
  ]);
  // Com aceleradores (ADR 0013): produção proporcional a `seconds` na velocidade atual (fração
  // de ciclo conta — com 5 min, os negócios de ciclo longo não ficam de fora).
  return owned.reduce((sum, pb) => {
    const cycleMs = effectiveCycleMs(pb.business.cycleSeconds, speedPercentAt(pb, ctx, now));
    return (
      sum +
      (profitNow(pb.business, pb.level, stars, ev, pb) * BigInt(seconds * 1000)) / BigInt(cycleMs)
    );
  }, 0n);
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
  platform?: string,
) {
  const purchases = purchasesFor(platform);
  const ads = adsFor(platform);
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
  const [vip, adsToday, vipClaim] = await Promise.all([
    vipUntil(db, playerId, now),
    // Janela corrida de 24 h (ADR 0035): mais antigo primeiro, para dizer quando libera.
    db.adReward.findMany({
      where: {
        playerId,
        placement: "ad_boost",
        status: "CLAIMED",
        claimedAt: { gt: new Date(now.getTime() - AD_WINDOW_MS) },
      },
      select: { claimedAt: true },
      orderBy: { claimedAt: "asc" },
    }),
    db.vipDailyClaim.findUnique({ where: { playerId_day: { playerId, day: gameDay(now) } } }),
  ]);
  // Versão sem dinheiro real / sem anúncios (ADR 0018): esses itens nem aparecem.
  const visible = STORE_ITEMS.filter(
    (i) =>
      (purchases || (i.kind !== "iap" && i.kind !== "subscription" && i.kind !== "double")) &&
      (ads || i.kind !== "ad"),
  );
  const items = await Promise.all(
    visible.map(async (i) => {
      const seconds = i.kind === "boost" ? i.hours * 3600 : i.kind === "ad" ? i.minutes * 60 : 0;
      return {
        ...i,
        ...("gems" in i ? { gems: i.gems.toString() } : {}),
        ...("costGems" in i ? { costGems: i.costGems.toString() } : {}),
        ...(seconds > 0
          ? {
              estimateCoins: (await productionFor(db, playerId, district, seconds, now)).toString(),
            }
          : {}),
        ...(i.kind === "ad"
          ? {
              usedToday: adsToday.length,
              // Quando o próximo anúncio libera (só com o limite cheio); null = já pode assistir.
              nextAt:
                adsToday.length >= i.dailyLimit && adsToday[0]?.claimedAt
                  ? new Date(adsToday[0].claimedAt.getTime() + AD_WINDOW_MS).toISOString()
                  : null,
            }
          : {}),
        ...(i.kind === "double"
          ? {
              usedThisMonth: await db.purchaseReceipt.count({
                where: {
                  playerId,
                  productId: i.productId,
                  createdAt: { gte: monthBounds(now).start },
                },
              }),
            }
          : {}),
      };
    }),
  );
  return {
    sandbox: storeMode === "mock" && (purchases || ads),
    purchasesEnabled: purchases,
    // Pacotes promocionais da semana/feriado (ADR 0024): só com compras ligadas na plataforma.
    offers: purchases ? await offersFor(db, playerId, now) : [],
    adsEnabled: ads,
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
export function buyWithGems(itemId: string, district: string | undefined, now: Date, times = 1) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const item = storeItem(itemId);
    if (!item || (item.kind !== "auto_collect" && item.kind !== "boost" && item.kind !== "turbo")) {
      throw Errors.storeItemNotFound(itemId);
    }
    // Várias de uma vez (toques rápidos juntados): quantas couberem no saldo, ao menos 1.
    const n =
      item.costGems > 0n ? Math.max(1, Math.min(times, Number(wallet.gems / item.costGems))) : 1;
    const hours = item.hours * n;
    let w = await applyGems(
      tx,
      wallet,
      -item.costGems * BigInt(n),
      `store:${item.id}`,
      idempotencyKey,
      now,
    );
    const body: Record<string, unknown> = { bought: item.id, times: n };

    if (item.kind === "turbo") {
      const player = await tx.player.findUniqueOrThrow({ where: { id: wallet.playerId } });
      const active = player.turboUntil && player.turboUntil > now;
      const until = new Date(
        (active ? player.turboUntil!.getTime() : now.getTime()) + hours * 3_600_000,
      );
      await tx.player.update({
        where: { id: wallet.playerId },
        data: { turboUntil: until, turboFrom: active ? player.turboFrom : now },
      });
      body.turboUntil = until.toISOString();
    } else if (item.kind === "auto_collect") {
      const player = await tx.player.findUniqueOrThrow({ where: { id: wallet.playerId } });
      const from =
        player.autoCollectUntil && player.autoCollectUntil > now ? player.autoCollectUntil : now;
      const until = new Date(from.getTime() + hours * 3_600_000);
      await tx.player.update({ where: { id: wallet.playerId }, data: { autoCollectUntil: until } });
      body.autoCollectUntil = until.toISOString();
    } else {
      if (!district) throw new AppError(400, "DISTRICT_REQUIRED", "Informe o mapa do turbo");
      const amount = await productionFor(tx, wallet.playerId, district, hours * 3600, now);
      if (amount === 0n)
        throw new AppError(409, "NOTHING_TO_BOOST", "Construa um negócio neste mapa primeiro");
      w = await applyCoins(tx, w, amount, `boost:${item.id}`, `${idempotencyKey}:coins`, now);
      body.coins = amount.toString();
      body.district = district;
    }
    await track(tx, wallet.playerId, "store_gems_spent", { item: item.id, times: n });
    return {
      statusCode: 200,
      body: { ...body, state: await getPlayerState(tx, wallet.playerId, now) },
    };
  };
}
