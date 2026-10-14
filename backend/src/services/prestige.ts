import type { Db, Tx } from "../db/prisma.js";
import { AppError } from "../errors.js";
import { bonusPercent, PRESTIGE_REQUIRES, starsFor } from "../economy/prestige.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { PRODUCTION_REASONS } from "./achievements.js";
import { track } from "./analytics.js";
import { getPlayerState } from "./game.js";
import { applyCoins } from "./wallet.js";

type Reader = Db | Tx;

export interface PrestigeView {
  stars: number;
  bonusPercent: number;
  count: number;
  /** Faturamento de produção desde o último prestígio (base das estrelas). */
  earnedSinceLast: string;
  starsToGain: number;
  /** Bônus total depois de vender agora. */
  nextBonusPercent: number;
  /** Mapa que precisa estar completo. */
  requires: string;
  requirementMet: boolean;
  available: boolean;
}

/** Situação do prestígio do jogador (tela "Vender o império"). */
export async function getPrestige(db: Reader, playerId: string): Promise<PrestigeView> {
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
  const [earned, total, owned] = await Promise.all([
    db.walletLedger.aggregate({
      where: {
        playerId,
        currency: "COINS",
        reason: { in: PRODUCTION_REASONS },
        ...(player.lastPrestigeAt ? { createdAt: { gt: player.lastPrestigeAt } } : {}),
      },
      _sum: { delta: true },
    }),
    db.businessDefinition.count({ where: { district: PRESTIGE_REQUIRES } }),
    db.playerBusiness.count({ where: { playerId, business: { district: PRESTIGE_REQUIRES } } }),
  ]);
  const earnedSince = earned._sum.delta ?? 0n;
  const starsToGain = starsFor(earnedSince);
  const requirementMet = total > 0 && owned >= total;
  return {
    stars: player.prestigeStars,
    bonusPercent: bonusPercent(player.prestigeStars),
    count: player.prestigeCount,
    earnedSinceLast: earnedSince.toString(),
    starsToGain,
    nextBonusPercent: bonusPercent(player.prestigeStars + starsToGain),
    requires: PRESTIGE_REQUIRES,
    requirementMet,
    available: requirementMet && starsToGain >= 1,
  };
}

/**
 * "Vender o império": zera negócios, níveis, ajudantes, moedas (volta ao saldo inicial) e mapas;
 * soma as estrelas. Mantém diamantes, conquistas, VIP, auto-coleta comprada e ranking.
 */
export function sellEmpire(startingCoins: bigint, now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const p = await getPrestige(tx, wallet.playerId);
    if (!p.available) {
      throw new AppError(409, "PRESTIGE_NOT_AVAILABLE", "Ainda não dá para vender o império", {
        requires: p.requires,
        requirementMet: p.requirementMet,
        starsToGain: p.starsToGain,
      });
    }
    await tx.playerBusiness.deleteMany({ where: { playerId: wallet.playerId } });
    await applyCoins(
      tx,
      wallet,
      startingCoins - wallet.coins,
      "prestige_reset",
      idempotencyKey,
      now,
    );
    await tx.player.update({
      where: { id: wallet.playerId },
      data: {
        prestigeStars: { increment: p.starsToGain },
        prestigeCount: { increment: 1 },
        lastPrestigeAt: now,
        currentDistrict: "praia",
        lastAfkTotal: 0n,
        lastAfkAt: null,
        lastAfkDoubled: false,
      },
    });
    await track(tx, wallet.playerId, "prestige", {
      gained: p.starsToGain,
      stars: p.stars + p.starsToGain,
      count: p.count + 1,
    });
    return {
      statusCode: 200,
      body: {
        gained: p.starsToGain,
        prestige: await getPrestige(tx, wallet.playerId),
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}
