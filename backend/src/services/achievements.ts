import type { Db, Tx } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { ACHIEVEMENTS, type AchievementStats, achievementById } from "../economy/achievements.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { track } from "./analytics.js";
import { getPlayerState } from "./game.js";
import { applyGems } from "./wallet.js";

type Reader = Db | Tx;

/** Motivos do ledger que contam como faturamento de produção (conquistas e ranking). */
export const PRODUCTION_REASONS = ["production_collect", "production_auto"];
/** Lançamento gravado ao vender o império (marco de recomeço do ranking da semana). */
export const PRESTIGE_REASON = "prestige_reset";

async function stats(db: Reader, playerId: string): Promise<AchievementStats> {
  const [owned, defs, earned] = await Promise.all([
    db.playerBusiness.findMany({ where: { playerId }, include: { business: true } }),
    db.businessDefinition.findMany({ select: { district: true } }),
    db.walletLedger.aggregate({
      where: { playerId, currency: "COINS", reason: { in: PRODUCTION_REASONS } },
      _sum: { delta: true },
    }),
  ]);
  const ownedByDistrict: Record<string, number> = {};
  for (const pb of owned)
    ownedByDistrict[pb.business.district] = (ownedByDistrict[pb.business.district] ?? 0) + 1;
  const totalByDistrict: Record<string, number> = {};
  for (const d of defs) totalByDistrict[d.district] = (totalByDistrict[d.district] ?? 0) + 1;
  const player = await db.player.findUnique({
    where: { id: playerId },
    select: { prestigeCount: true },
  });
  return {
    prestigeCount: player?.prestigeCount ?? 0,
    ownedCount: owned.length,
    praiaComplete: (ownedByDistrict.praia ?? 0) >= (totalByDistrict.praia ?? 4),
    ownedByDistrict,
    totalByDistrict,
    helpers: owned.filter((pb) => pb.managerUnlocked).length,
    maxLevel: owned.reduce((m, pb) => Math.max(m, pb.level), 0),
    lifetimeEarned: earned._sum.delta ?? 0n,
  };
}

/** Lista conquistas com progresso; grava o desbloqueio das recém-alcançadas. */
export async function listAchievements(db: Reader, playerId: string, now: Date) {
  const s = await stats(db, playerId);
  const rows = await db.playerAchievement.findMany({ where: { playerId } });
  const byId = new Map(rows.map((r) => [r.achievementId, r]));
  const fresh = ACHIEVEMENTS.filter((a) => {
    const p = a.progress(s);
    return p.value >= p.target && !byId.has(a.id);
  });
  if (fresh.length > 0) {
    await db.playerAchievement.createMany({
      data: fresh.map((a) => ({ playerId, achievementId: a.id, unlockedAt: now })),
      skipDuplicates: true,
    });
  }
  return {
    achievements: ACHIEVEMENTS.map((a) => {
      const p = a.progress(s);
      const row = byId.get(a.id);
      const unlocked = p.value >= p.target || Boolean(row);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        rewardGems: a.rewardGems,
        progress: (p.value > p.target ? p.target : p.value).toString(),
        target: p.target.toString(),
        unlocked,
        claimed: Boolean(row?.claimedAt),
      };
    }),
  };
}

export function claimAchievement(achievementId: string, now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const def = achievementById(achievementId);
    if (!def) throw Errors.achievementNotFound(achievementId);
    const list = await listAchievements(tx, wallet.playerId, now);
    const view = list.achievements.find((a) => a.id === achievementId);
    if (!view?.unlocked) throw Errors.achievementLocked(achievementId);
    if (view.claimed) throw Errors.achievementAlreadyClaimed(achievementId);

    await applyGems(
      tx,
      wallet,
      BigInt(def.rewardGems),
      `achievement:${def.id}`,
      idempotencyKey,
      now,
    );
    await tx.playerAchievement.update({
      where: { playerId_achievementId: { playerId: wallet.playerId, achievementId } },
      data: { claimedAt: now },
    });
    await track(tx, wallet.playerId, "achievement_claimed", { achievement: def.id });
    return {
      statusCode: 200,
      body: {
        claimed: achievementId,
        achievements: (await listAchievements(tx, wallet.playerId, now)).achievements,
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}
