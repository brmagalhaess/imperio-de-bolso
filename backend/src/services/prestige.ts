import type { Db, Tx } from "../db/prisma.js";
import { AppError } from "../errors.js";
import { DISTRICTS } from "../economy/districts.js";
import { bonusPercent, PRESTIGE_MAPS, PRESTIGE_REQUIRES, starsFor } from "../economy/prestige.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { PRESTIGE_REASON, PRODUCTION_REASONS } from "./achievements.js";
import { track } from "./analytics.js";
import { getPlayerState } from "./game.js";
import { refreshMissionsAfterPrestige } from "./missions.js";
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
  /** Requisito: "imperio_completo" (negócios e ajudantes dos 8 primeiros mapas — ADR 0034). */
  requires: string;
  totalBusinesses: number;
  ownedBusinesses: number;
  hiredHelpers: number;
  requirementMet: boolean;
  available: boolean;
}

const REQUIRED_MAPS = DISTRICTS.slice(0, PRESTIGE_MAPS) as string[];

/** Situação do prestígio do jogador (tela "Vender o império"). */
export async function getPrestige(db: Reader, playerId: string): Promise<PrestigeView> {
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
  const [earned, total, owned, helpers] = await Promise.all([
    db.walletLedger.aggregate({
      where: {
        playerId,
        currency: "COINS",
        reason: { in: PRODUCTION_REASONS },
        ...(player.lastPrestigeAt ? { createdAt: { gt: player.lastPrestigeAt } } : {}),
      },
      _sum: { delta: true },
    }),
    db.businessDefinition.count({ where: { district: { in: REQUIRED_MAPS } } }),
    db.playerBusiness.count({ where: { playerId, business: { district: { in: REQUIRED_MAPS } } } }),
    db.playerBusiness.count({
      where: { playerId, managerUnlocked: true, business: { district: { in: REQUIRED_MAPS } } },
    }),
  ]);
  const earnedSince = earned._sum.delta ?? 0n;
  const starsToGain = starsFor(earnedSince);
  const requirementMet = total > 0 && owned >= total && helpers >= total;
  return {
    stars: player.prestigeStars,
    bonusPercent: bonusPercent(player.prestigeStars),
    count: player.prestigeCount,
    earnedSinceLast: earnedSince.toString(),
    starsToGain,
    nextBonusPercent: bonusPercent(player.prestigeStars + starsToGain),
    requires: PRESTIGE_REQUIRES,
    totalBusinesses: total,
    ownedBusinesses: owned,
    hiredHelpers: helpers,
    requirementMet,
    available: requirementMet && starsToGain >= 1,
  };
}

/**
 * "Vender o império": zera negócios, níveis, ajudantes, moedas (volta ao saldo inicial) e mapas;
 * soma as estrelas. Mantém diamantes, conquistas, VIP e auto-coleta comprada. A pontuação da
 * semana no ranking recomeça do zero e as missões de hoje ainda não resgatadas são sorteadas de
 * novo com alvos e prêmios do império novo.
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
      PRESTIGE_REASON,
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
    await refreshMissionsAfterPrestige(tx, wallet.playerId, now);
    // Evento em andamento ainda não resgatado: sai, e a meta é calculada de novo com a renda do
    // império novo na próxima consulta (a contagem recomeça da venda).
    await tx.playerEvent.deleteMany({ where: { playerId: wallet.playerId, claimedAt: null } });
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
