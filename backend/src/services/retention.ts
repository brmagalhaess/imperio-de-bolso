import type { Db, Tx } from "../db/prisma.js";
import { AppError } from "../errors.js";
import { DAILY_REWARDS, MISSION_CHEST } from "../economy/daily.js";
import { DISTRICTS, unlockedDistricts } from "../economy/districts.js";
import { EVENT_PRIZE_GEMS, EVENT_TARGET_SECONDS, weekendEvent } from "../economy/events.js";
import { profitPerCycle } from "../economy/formulas.js";
import { niceRound, rewardCap } from "../economy/missions.js";
import { effectiveCycleMs, speedPercentAt } from "../economy/speed.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { gameDay } from "../lib/time.js";
import { PRODUCTION_REASONS } from "./achievements.js";
import { track } from "./analytics.js";
import { getPlayerState, speedContext, starsOf } from "./game.js";
import { missionContext } from "./missions.js";
import { applyCoins, applyGems } from "./wallet.js";

// Retenção (ADR 0014): calendário de 7 dias, baú das missões e evento de fim de semana.

type Reader = Db | Tx;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Renda por segundo agora (negócios comprados, com bônus e aceleradores). */
export async function incomePerSecond(db: Reader, playerId: string, now: Date): Promise<number> {
  const [owned, stars, ctx] = await Promise.all([
    db.playerBusiness.findMany({ where: { playerId }, include: { business: true } }),
    starsOf(db, playerId),
    speedContext(db, playerId, now),
  ]);
  return owned.reduce((sum, pb) => {
    const ms = effectiveCycleMs(pb.business.cycleSeconds, speedPercentAt(pb, ctx, now));
    return sum + (Number(profitPerCycle(pb.business, pb.level, stars)) * 1000) / ms;
  }, 0);
}

/** Soma tempo de Turbo 2× (prêmios do calendário, do baú e da Loja). */
export async function grantTurbo(tx: Tx, playerId: string, minutes: number, now: Date) {
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
  const active = player.turboUntil !== null && player.turboUntil > now;
  const base = active ? player.turboUntil!.getTime() : now.getTime();
  const until = new Date(base + minutes * 60_000);
  await tx.player.update({
    where: { id: playerId },
    data: { turboUntil: until, turboFrom: active ? player.turboFrom : now },
  });
  return until;
}

// --- Calendário de 7 dias ---------------------------------------------------

function nextDay(player: { loginStreak: number; lastLoginRewardDay: string | null }, now: Date) {
  const today = gameDay(now);
  if (player.lastLoginRewardDay === today) return { day: player.loginStreak, claimedToday: true };
  const yesterday = gameDay(new Date(now.getTime() - DAY_MS));
  const day = player.lastLoginRewardDay === yesterday ? (player.loginStreak % 7) + 1 : 1;
  return { day, claimedToday: false };
}

async function rewardViews(db: Reader, playerId: string, now: Date) {
  const [income, ctx] = await Promise.all([
    incomePerSecond(db, playerId, now),
    missionContext(db, playerId, now),
  ]);
  // Mesmo teto das missões: no máximo o preço do próximo negócio (ver rewardCap).
  const cap = rewardCap(ctx.cheapestBuy);
  return DAILY_REWARDS.map((r) => ({
    day: r.day,
    coins: r.coinsMinutes
      ? (() => {
          const min = r.minCoins ?? 0n;
          const v = niceRound(Math.min(income * r.coinsMinutes * 60, cap));
          return (v > min ? v : min).toString();
        })()
      : null,
    gems: r.gems ?? 0,
    turboMinutes: r.turboMinutes ?? 0,
  }));
}

export async function getDailyReward(db: Reader, playerId: string, now: Date) {
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
  const { day, claimedToday } = nextDay(player, now);
  return {
    day,
    claimedToday,
    rewards: await rewardViews(db, playerId, now),
    serverTime: now.toISOString(),
  };
}

export function claimDailyReward(now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const player = await tx.player.findUniqueOrThrow({ where: { id: wallet.playerId } });
    const { day, claimedToday } = nextDay(player, now);
    if (claimedToday)
      throw new AppError(409, "DAILY_REWARD_CLAIMED", "Prêmio de hoje já resgatado");
    const reward = (await rewardViews(tx, wallet.playerId, now))[day - 1]!;
    let w = wallet;
    if (reward.coins)
      w = await applyCoins(tx, w, BigInt(reward.coins), `daily:${day}`, idempotencyKey, now);
    if (reward.gems > 0) {
      w = await applyGems(
        tx,
        w,
        BigInt(reward.gems),
        `daily:${day}`,
        `${idempotencyKey}:gems`,
        now,
      );
    }
    if (reward.turboMinutes > 0) await grantTurbo(tx, wallet.playerId, reward.turboMinutes, now);
    await tx.player.update({
      where: { id: wallet.playerId },
      data: { loginStreak: day, lastLoginRewardDay: gameDay(now) },
    });
    await track(tx, wallet.playerId, "daily_reward_claimed", { day });
    return {
      statusCode: 200,
      body: { claimed: day, reward, state: await getPlayerState(tx, wallet.playerId, now) },
    };
  };
}

// --- Baú das missões ---------------------------------------------------------

export async function missionChestView(db: Reader, playerId: string, now: Date) {
  const day = gameDay(now);
  const [player, missions] = await Promise.all([
    db.player.findUniqueOrThrow({ where: { id: playerId }, select: { missionChestDay: true } }),
    db.playerMission.findMany({ where: { playerId, day } }),
  ]);
  const claimedMissions = missions.filter((m) => m.claimedAt !== null).length;
  return {
    gems: MISSION_CHEST.gems,
    turboMinutes: MISSION_CHEST.turboMinutes,
    progress: claimedMissions,
    target: missions.length,
    available: missions.length > 0 && claimedMissions === missions.length,
    claimed: player.missionChestDay === day,
  };
}

export function claimMissionChest(now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const chest = await missionChestView(tx, wallet.playerId, now);
    if (chest.claimed) throw new AppError(409, "MISSION_CHEST_CLAIMED", "Baú de hoje já aberto");
    if (!chest.available) {
      throw new AppError(409, "MISSION_CHEST_LOCKED", "Resgate as missões do dia para abrir o baú");
    }
    await applyGems(tx, wallet, BigInt(chest.gems), "mission_chest", idempotencyKey, now);
    await grantTurbo(tx, wallet.playerId, chest.turboMinutes, now);
    await tx.player.update({
      where: { id: wallet.playerId },
      data: { missionChestDay: gameDay(now) },
    });
    await track(tx, wallet.playerId, "mission_chest_opened");
    return {
      statusCode: 200,
      body: {
        chest: await missionChestView(tx, wallet.playerId, now),
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}

// --- Evento de fim de semana -------------------------------------------------

/** Mapa mais avançado já liberado (o evento acontece nele). */
async function latestUnlocked(db: Reader, playerId: string): Promise<string> {
  const [defs, owned] = await Promise.all([
    db.businessDefinition.findMany({ orderBy: { sortOrder: "asc" } }),
    db.playerBusiness.findMany({ where: { playerId } }),
  ]);
  const open = unlockedDistricts(defs, new Set(owned.map((pb) => pb.businessId)));
  return [...DISTRICTS].reverse().find((d) => open.has(d)) ?? "praia";
}

async function earnedBetween(db: Reader, playerId: string, start: Date, end: Date) {
  const agg = await db.walletLedger.aggregate({
    where: {
      playerId,
      currency: "COINS",
      reason: { in: PRODUCTION_REASONS },
      createdAt: { gte: start, lt: end },
    },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0n;
}

/**
 * Início da contagem do evento para o jogador: o começo do evento ou, se ele vendeu o império
 * durante o evento, a hora da venda (recomeça do zero, como no ranking).
 */
async function eventCountFrom(db: Reader, playerId: string, start: Date, end: Date) {
  const p = await db.player.findUnique({
    where: { id: playerId },
    select: { lastPrestigeAt: true },
  });
  const sold = p?.lastPrestigeAt;
  return sold && sold > start && sold < end ? sold : start;
}

/** Evento do fim de semana: entra no evento na primeira consulta (mapa e meta ficam fixos). */
export async function getEvent(db: Db, playerId: string, now: Date) {
  const ev = weekendEvent(now);
  if (!ev) return { active: false, serverTime: now.toISOString() };
  let row = await db.playerEvent.findUnique({
    where: { playerId_eventId: { playerId, eventId: ev.id } },
  });
  if (!row) {
    const income = await incomePerSecond(db, playerId, now);
    const target = niceRound(Math.max(1_000, income * EVENT_TARGET_SECONDS));
    await db.playerEvent.createMany({
      data: [{ playerId, eventId: ev.id, district: await latestUnlocked(db, playerId), target }],
      skipDuplicates: true,
    });
    row = await db.playerEvent.findUniqueOrThrow({
      where: { playerId_eventId: { playerId, eventId: ev.id } },
    });
  }
  const from = await eventCountFrom(db, playerId, ev.start, ev.end);
  const progress = await earnedBetween(db, playerId, from, ev.end);
  return {
    active: true,
    id: ev.id,
    district: row.district,
    profitMultiplier: 2,
    endsAt: ev.end.toISOString(),
    target: row.target.toString(),
    progress: (progress > row.target ? row.target : progress).toString(),
    prizeGems: EVENT_PRIZE_GEMS,
    completed: progress >= row.target,
    claimed: row.claimedAt !== null,
    serverTime: now.toISOString(),
  };
}

export function claimEvent(now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const ev = weekendEvent(now);
    const row = ev
      ? await tx.playerEvent.findUnique({
          where: { playerId_eventId: { playerId: wallet.playerId, eventId: ev.id } },
        })
      : null;
    if (!ev || !row) throw new AppError(409, "EVENT_NOT_ACTIVE", "Nenhum evento agora");
    if (row.claimedAt) throw new AppError(409, "EVENT_ALREADY_CLAIMED", "Prêmio já resgatado");
    const from = await eventCountFrom(tx, wallet.playerId, ev.start, ev.end);
    const progress = await earnedBetween(tx, wallet.playerId, from, ev.end);
    if (progress < row.target) {
      throw new AppError(409, "EVENT_GOAL_NOT_REACHED", "Meta do evento ainda não alcançada");
    }
    await applyGems(tx, wallet, BigInt(EVENT_PRIZE_GEMS), `event:${ev.id}`, idempotencyKey, now);
    await tx.playerEvent.update({
      where: { playerId_eventId: { playerId: wallet.playerId, eventId: ev.id } },
      data: { claimedAt: now },
    });
    await track(tx, wallet.playerId, "event_claimed", { event: ev.id });
    return {
      statusCode: 200,
      body: {
        claimed: ev.id,
        gems: EVENT_PRIZE_GEMS,
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}
