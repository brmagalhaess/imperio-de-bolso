import type { Db, Tx } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { profitPerCycle } from "../economy/formulas.js";
import {
  MISSION_REWARD_GEMS,
  type MissionContext,
  type MissionMetric,
  MISSION_TEMPLATES,
  missionRewardCoins,
  pickDailyMissions,
  templateById,
} from "../economy/missions.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { previousDistrict } from "../economy/districts.js";
import { dayBounds, gameDay } from "../lib/time.js";
import { track } from "./analytics.js";
import { getPlayerState, starsOf } from "./game.js";
import { applyCoins, applyGems } from "./wallet.js";

type Reader = Db | Tx;

export interface MissionView {
  id: string;
  template: string;
  title: string;
  target: string;
  progress: string;
  completed: boolean;
  claimed: boolean;
  rewardCoins: string;
  rewardGems: number;
}

async function missionContext(db: Reader, playerId: string): Promise<MissionContext> {
  const [defs, owned, stars] = await Promise.all([
    db.businessDefinition.findMany(),
    db.playerBusiness.findMany({ where: { playerId }, include: { business: true } }),
    starsOf(db, playerId),
  ]);
  const ownedIds = new Set(owned.map((pb) => pb.businessId));
  // Um mapa abre quando todos os negócios do mapa anterior foram comprados (em cadeia).
  const complete = (district: string) =>
    defs.filter((d) => d.district === district).every((d) => ownedIds.has(d.id));
  const unlocked = (district: string): boolean => {
    const prev = previousDistrict(district);
    return prev === null || (unlocked(prev) && complete(prev));
  };
  const cityUnlocked = unlocked("cidade");
  return {
    incomePerSecond: owned.reduce(
      (sum, pb) =>
        sum + Number(profitPerCycle(pb.business, pb.level, stars)) / pb.business.cycleSeconds,
      0,
    ),
    ownedCount: owned.length,
    canBuy: defs.some((d) => !ownedIds.has(d.id) && unlocked(d.district)),
    canHire: owned.some((pb) => !pb.managerUnlocked),
    hasHelper: owned.some((pb) => pb.managerUnlocked),
    cityUnlocked,
  };
}

/** Garante as 3 missões do dia (idempotente; corrida tratada pelo índice único). */
export async function ensureDailyMissions(db: Reader, playerId: string, now: Date) {
  const day = gameDay(now);
  const existing = await db.playerMission.findMany({ where: { playerId, day } });
  if (existing.length > 0) return existing;
  const ctx = await missionContext(db, playerId);
  const reward = missionRewardCoins(ctx);
  await db.playerMission.createMany({
    data: pickDailyMissions(playerId, day, ctx).map((t) => ({
      playerId,
      day,
      template: t.id,
      target: t.target(ctx),
      rewardCoins: reward,
      rewardGems: MISSION_REWARD_GEMS,
    })),
    skipDuplicates: true,
  });
  return db.playerMission.findMany({ where: { playerId, day } });
}

/** Soma progresso nas missões de hoje que medem `metric` (chamado pelos comandos). */
export async function trackMission(
  tx: Tx,
  playerId: string,
  metric: MissionMetric,
  amount: bigint,
  now: Date,
): Promise<void> {
  if (amount <= 0n) return;
  await ensureDailyMissions(tx, playerId, now);
  const templates = MISSION_TEMPLATES.filter((t) => t.metric === metric).map((t) => t.id);
  await tx.playerMission.updateMany({
    where: { playerId, day: gameDay(now), template: { in: templates }, claimedAt: null },
    data: { progress: { increment: amount } },
  });
}

function toView(m: {
  id: string;
  template: string;
  target: bigint;
  progress: bigint;
  claimedAt: Date | null;
  rewardCoins: bigint;
  rewardGems: number;
}): MissionView {
  const t = templateById(m.template);
  const progress = m.progress > m.target ? m.target : m.progress;
  return {
    id: m.id,
    template: m.template,
    title: (t?.title ?? m.template).replace("{n}", m.target.toLocaleString("pt-BR")),
    target: m.target.toString(),
    progress: progress.toString(),
    completed: m.progress >= m.target,
    claimed: m.claimedAt !== null,
    rewardCoins: m.rewardCoins.toString(),
    rewardGems: m.rewardGems,
  };
}

export async function listMissions(db: Reader, playerId: string, now: Date) {
  const missions = await ensureDailyMissions(db, playerId, now);
  const order = new Map(MISSION_TEMPLATES.map((t, i) => [t.id, i]));
  missions.sort((a, b) => (order.get(a.template) ?? 99) - (order.get(b.template) ?? 99));
  return {
    day: gameDay(now),
    resetsAt: dayBounds(now).end.toISOString(),
    missions: missions.map(toView),
    serverTime: now.toISOString(),
  };
}

/** Resgata o prêmio de uma missão concluída de hoje (uma única vez). */
export function claimMission(missionId: string, now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const m = await tx.playerMission.findUnique({ where: { id: missionId } });
    if (!m || m.playerId !== wallet.playerId || m.day !== gameDay(now)) {
      throw Errors.missionNotFound(missionId);
    }
    if (m.claimedAt) throw Errors.missionAlreadyClaimed(missionId);
    if (m.progress < m.target) throw Errors.missionNotCompleted(missionId);

    let w = await applyCoins(
      tx,
      wallet,
      m.rewardCoins,
      `mission:${m.template}`,
      idempotencyKey,
      now,
    );
    if (m.rewardGems > 0) {
      w = await applyGems(
        tx,
        w,
        BigInt(m.rewardGems),
        `mission:${m.template}`,
        `${idempotencyKey}:gems`,
        now,
      );
    }
    await tx.playerMission.update({ where: { id: m.id }, data: { claimedAt: now } });
    await track(tx, wallet.playerId, "mission_claimed", { template: m.template });

    return {
      statusCode: 200,
      body: {
        claimed: m.id,
        missions: (await listMissions(tx, wallet.playerId, now)).missions,
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}
