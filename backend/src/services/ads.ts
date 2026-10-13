import type { Db, Tx } from "../db/prisma.js";
import { AppError } from "../errors.js";
import {
  AD_SESSION_TTL_MS,
  OFFLINE_DOUBLE_DAILY_LIMIT,
  OFFLINE_DOUBLE_WINDOW_MS,
  storeItem,
} from "../economy/store.js";
import type { SsvParams } from "../lib/admob-ssv.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { dayBounds } from "../lib/time.js";
import { track } from "./analytics.js";
import { getPlayerState } from "./game.js";
import { productionFor } from "./store.js";
import { applyCoins } from "./wallet.js";

// Anúncios recompensados (doc §12, plano §23, ADR 0008). Fluxo:
// 1) POST /ads/start cria a sessão (o servidor calcula o prêmio e aplica limites);
// 2) o anúncio é exibido com custom_data = id da sessão;
// 3) a sessão vira VERIFIED pelo SSV assinado do AdMob (produção) ou pela confirmação mock (dev);
// 4) POST /ads/claim paga uma única vez. O callback do cliente sozinho nunca paga.

export type Placement = "ad_boost" | "offline_double";

const AD_BOOST = storeItem("ad_boost") as { minutes: number; dailyLimit: number };

async function claimedToday(db: Db | Tx, playerId: string, placement: Placement, now: Date) {
  const { start } = dayBounds(now);
  return db.adReward.count({
    where: { playerId, placement, status: "CLAIMED", claimedAt: { gte: start } },
  });
}

export function startAd(placement: Placement, district: string | undefined, now: Date) {
  return async ({ tx, wallet }: CommandContext): Promise<CommandResult> => {
    let reward = 0n;
    if (placement === "ad_boost") {
      if ((await claimedToday(tx, wallet.playerId, placement, now)) >= AD_BOOST.dailyLimit) {
        throw new AppError(409, "AD_DAILY_LIMIT", "Limite de anúncios de hoje atingido");
      }
      if (!district) throw new AppError(400, "DISTRICT_REQUIRED", "Informe o mapa");
      reward = await productionFor(tx, wallet.playerId, district, AD_BOOST.minutes * 60);
      if (reward === 0n)
        throw new AppError(409, "NOTHING_TO_BOOST", "Construa um negócio neste mapa primeiro");
    } else {
      const p = await tx.player.findUniqueOrThrow({ where: { id: wallet.playerId } });
      const fresh =
        p.lastAfkAt && now.getTime() - p.lastAfkAt.getTime() <= OFFLINE_DOUBLE_WINDOW_MS;
      if (!fresh || p.lastAfkDoubled || p.lastAfkTotal <= 0n) {
        throw new AppError(409, "AD_NOT_AVAILABLE", "Não há ganhos recentes para dobrar");
      }
      if ((await claimedToday(tx, wallet.playerId, placement, now)) >= OFFLINE_DOUBLE_DAILY_LIMIT) {
        throw new AppError(409, "AD_DAILY_LIMIT", "Limite de anúncios de hoje atingido");
      }
      reward = p.lastAfkTotal;
    }
    const session = await tx.adReward.create({
      data: {
        playerId: wallet.playerId,
        placement,
        district: district ?? null,
        rewardCoins: reward,
        status: "PENDING",
        expiresAt: new Date(now.getTime() + AD_SESSION_TTL_MS),
        createdAt: now,
      },
    });
    return {
      statusCode: 201,
      body: {
        sessionId: session.id,
        placement,
        rewardCoins: reward.toString(),
        expiresAt: session.expiresAt.toISOString(),
      },
    };
  };
}

/** Marca a sessão como verificada (SSV do AdMob ou mock). Idempotente por transação. */
async function markVerified(db: Db, sessionId: string, transactionId: string, now: Date) {
  return db.$transaction(async (tx) => {
    const byTx = await tx.adReward.findUnique({ where: { transactionId } });
    if (byTx) return byTx.id === sessionId; // reenvio do mesmo callback
    const s = await tx.adReward.findUnique({ where: { id: sessionId } });
    if (!s || s.status !== "PENDING" || s.expiresAt < now) return false;
    await tx.adReward.update({
      where: { id: sessionId },
      data: { status: "VERIFIED", transactionId, verifiedAt: now },
    });
    return true;
  });
}

/** Desenvolvimento (ADS_MODE=mock): o "anúncio de teste" terminou. Nunca em produção. */
export async function mockComplete(db: Db, playerId: string, sessionId: string, now: Date) {
  const s = await db.adReward.findUnique({ where: { id: sessionId } });
  if (!s || s.playerId !== playerId)
    throw new AppError(404, "AD_SESSION_NOT_FOUND", "Sessão não encontrada");
  if (!(await markVerified(db, sessionId, `mock-${sessionId}`, now))) {
    throw new AppError(409, "AD_SESSION_INVALID", "Sessão expirada ou já usada");
  }
}

/** Produção: callback SSV já com a assinatura validada. */
export async function ssvVerified(db: Db, params: SsvParams, now: Date): Promise<boolean> {
  return markVerified(db, params.customData, params.transactionId, now);
}

export function claimAd(sessionId: string, now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const s = await tx.adReward.findUnique({ where: { id: sessionId } });
    if (!s || s.playerId !== wallet.playerId) {
      throw new AppError(404, "AD_SESSION_NOT_FOUND", "Sessão não encontrada");
    }
    if (s.status === "CLAIMED")
      throw new AppError(409, "AD_ALREADY_CLAIMED", "Prêmio já resgatado");
    if (s.status !== "VERIFIED") {
      throw new AppError(409, "AD_NOT_VERIFIED", "Anúncio ainda não confirmado pelo servidor");
    }
    const placement = s.placement as Placement;
    if (placement === "offline_double") {
      const p = await tx.player.findUniqueOrThrow({ where: { id: wallet.playerId } });
      if (p.lastAfkDoubled) throw new AppError(409, "AD_ALREADY_CLAIMED", "Ganhos já dobrados");
      await tx.player.update({ where: { id: p.id }, data: { lastAfkDoubled: true } });
    } else if ((await claimedToday(tx, wallet.playerId, placement, now)) >= AD_BOOST.dailyLimit) {
      throw new AppError(409, "AD_DAILY_LIMIT", "Limite de anúncios de hoje atingido");
    }
    await applyCoins(tx, wallet, s.rewardCoins, `ad:${placement}`, idempotencyKey, now);
    await tx.adReward.update({ where: { id: s.id }, data: { status: "CLAIMED", claimedAt: now } });
    await track(tx, wallet.playerId, "rewarded_ad_completed", { placement });
    return {
      statusCode: 200,
      body: {
        claimed: s.id,
        coins: s.rewardCoins.toString(),
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}
