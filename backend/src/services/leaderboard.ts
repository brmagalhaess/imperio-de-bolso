import type { Db } from "../db/prisma.js";
import { AppError } from "../errors.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { track } from "./analytics.js";
import { getPlayerState } from "./game.js";
import { applyGems } from "./wallet.js";
import { gameDay, weekBounds } from "../lib/time.js";
import { PRODUCTION_REASONS } from "./achievements.js";

// Ranking semanal — "Desafio dos 7 dias" da conversa original: quem faturou mais com
// produção na semana (segunda 00:00 → domingo 23:59, horário de Brasília).

export const LEADERBOARD_SIZE = 50;

interface Row {
  playerId: string;
  displayName: string;
  score: bigint;
  rank: bigint;
}

export async function getLeaderboard(db: Db, playerId: string, now: Date) {
  const { start, end } = weekBounds(now);
  const rows = await db.$queryRaw<Row[]>`
    WITH scores AS (
      SELECT player_id, SUM(delta) AS score
      FROM wallet_ledger
      WHERE currency = 'COINS' AND reason = ANY(${PRODUCTION_REASONS})
        AND created_at >= ${start} AND created_at < ${end}
      GROUP BY player_id
    ), ranked AS (
      SELECT s.player_id AS "playerId", p.display_name AS "displayName", s.score,
             RANK() OVER (ORDER BY s.score DESC) AS rank
      FROM scores s JOIN players p ON p.id = s.player_id
    )
    SELECT * FROM ranked
    WHERE rank <= ${LEADERBOARD_SIZE} OR "playerId" = ${playerId}::uuid
    ORDER BY rank, "displayName"`;
  const view = (r: Row) => ({
    rank: Number(r.rank),
    displayName: r.displayName,
    score: r.score.toString(),
    isMe: r.playerId === playerId,
  });
  const me = rows.find((r) => r.playerId === playerId);
  return {
    week: { start: start.toISOString(), end: end.toISOString() },
    entries: rows.filter((r) => Number(r.rank) <= LEADERBOARD_SIZE).map(view),
    me: me ? view(me) : null,
    league: await getLeague(db, playerId, now),
    prizes: podiumPrizes(await leagueOf(db, playerId, now)),
    serverTime: now.toISOString(),
  };
}

// --- Ligas semanais (ADR 0014) ------------------------------------------------
// Bronze → Diamante. Cada semana o jogador disputa com quem está na mesma liga; na virada,
// os 20% do topo (que faturaram) sobem e os 20% de baixo descem (ligas com 5 ou mais).

export const LEAGUES = ["Bronze", "Prata", "Ouro", "Platina", "Diamante"] as const;
export const LEAGUE_MOVE_SHARE = 0.2;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const weekId = (now: Date) => gameDay(weekBounds(now).start);

interface ScoreRow {
  playerId: string;
  displayName: string;
  score: bigint;
}

/** Faturamento da semana de quem está na liga `league` naquela semana (0 se não faturou). */
async function leagueScores(db: Db, week: Date, league: number): Promise<ScoreRow[]> {
  const { start, end } = weekBounds(week);
  return db.$queryRaw<ScoreRow[]>`
    SELECT lw.player_id AS "playerId", p.display_name AS "displayName",
           COALESCE(SUM(l.delta), 0)::bigint AS score
    FROM player_league_weeks lw
    JOIN players p ON p.id = lw.player_id
    LEFT JOIN wallet_ledger l ON l.player_id = lw.player_id AND l.currency = 'COINS'
      AND l.reason = ANY(${PRODUCTION_REASONS}) AND l.created_at >= ${start} AND l.created_at < ${end}
    WHERE lw.week = ${weekId(week)} AND lw.league = ${league}
    GROUP BY lw.player_id, p.display_name
    ORDER BY score DESC, p.display_name`;
}

/** Quantos sobem/descem numa liga com `n` jogadores. */
export function leagueMoves(n: number) {
  return {
    promote: Math.max(1, Math.floor(n * LEAGUE_MOVE_SHARE)),
    demote: n >= 5 ? Math.floor(n * LEAGUE_MOVE_SHARE) : 0,
  };
}

/** Liga do jogador nesta semana; na primeira visita da semana aplica o resultado da anterior. */
export async function leagueOf(db: Db, playerId: string, now: Date): Promise<number> {
  const week = weekId(now);
  const current = await db.playerLeagueWeek.findUnique({
    where: { playerId_week: { playerId, week } },
  });
  if (current) return current.league;
  const last = await db.playerLeagueWeek.findFirst({
    where: { playerId, week: { lt: week } },
    orderBy: { week: "desc" },
  });
  let league = last?.league ?? 0;
  const prevWeek = new Date(now.getTime() - WEEK_MS);
  if (last && last.week === weekId(prevWeek)) {
    const standings = await leagueScores(db, prevWeek, last.league);
    const rank = standings.findIndex((r) => r.playerId === playerId) + 1;
    const me = standings[rank - 1];
    const { promote, demote } = leagueMoves(standings.length);
    if (me && me.score > 0n && rank <= promote) league = Math.min(league + 1, LEAGUES.length - 1);
    else if (rank > standings.length - demote) league = Math.max(league - 1, 0);
  }
  await db.playerLeagueWeek.createMany({
    data: [{ playerId, week, league }],
    skipDuplicates: true,
  });
  return (
    await db.playerLeagueWeek.findUniqueOrThrow({ where: { playerId_week: { playerId, week } } })
  ).league;
}

export async function getLeague(db: Db, playerId: string, now: Date) {
  const tier = await leagueOf(db, playerId, now);
  const standings = await leagueScores(db, now, tier);
  const view = (r: ScoreRow, i: number) => ({
    rank: i + 1,
    displayName: r.displayName,
    score: r.score.toString(),
    isMe: r.playerId === playerId,
  });
  const all = standings.map(view);
  const { promote, demote } = leagueMoves(standings.length);
  return {
    tier,
    name: LEAGUES[tier],
    size: standings.length,
    promote: tier < LEAGUES.length - 1 ? promote : 0,
    demote: tier > 0 ? demote : 0,
    entries: all.slice(0, LEADERBOARD_SIZE),
    me: all.find((e) => e.isMe) ?? null,
  };
}

// --- Ranking de estrelas (prestígio, de todos os tempos) ----------------------

export async function getStarsRanking(db: Db, playerId: string, now: Date) {
  const rows = await db.$queryRaw<
    { playerId: string; displayName: string; stars: number; rank: bigint }[]
  >`
    WITH ranked AS (
      SELECT id AS "playerId", display_name AS "displayName", prestige_stars AS stars,
             RANK() OVER (ORDER BY prestige_stars DESC) AS rank
      FROM players WHERE prestige_stars > 0
    )
    SELECT * FROM ranked
    WHERE rank <= ${LEADERBOARD_SIZE} OR "playerId" = ${playerId}::uuid
    ORDER BY rank, "displayName"`;
  const view = (r: (typeof rows)[number]) => ({
    rank: Number(r.rank),
    displayName: r.displayName,
    score: String(r.stars),
    isMe: r.playerId === playerId,
  });
  const me = rows.find((r) => r.playerId === playerId);
  return {
    entries: rows.filter((r) => Number(r.rank) <= LEADERBOARD_SIZE).map(view),
    me: me ? view(me) : null,
    serverTime: now.toISOString(),
  };
}

// --- Pódio semanal (ADR 0017) ---------------------------------------------------
// Fechada a semana, 1º, 2º e 3º lugar do ranking geral e de cada liga ganham diamantes.
// Conferido na primeira visita da semana seguinte; o jogador resgata pelo aviso no jogo.
// Vender o império não tira ninguém do ranking: a pontuação é o faturamento já registrado.

export const WEEK_PRIZES = [100, 60, 30] as const;
export const LEAGUE_PRIZES = [30, 20, 10] as const;

/** Prêmios em diamantes do pódio: ranking geral e liga (× nível da liga: Bronze 1 … Diamante 5). */
export function podiumPrizes(tier: number) {
  return { semana: [...WEEK_PRIZES], liga: LEAGUE_PRIZES.map((g) => g * (tier + 1)) };
}

async function weekRank(
  db: Db,
  playerId: string,
  week: Date,
): Promise<{ rank: number; score: bigint } | null> {
  const { start, end } = weekBounds(week);
  const rows = await db.$queryRaw<{ playerId: string; score: bigint; rank: bigint }[]>`
    WITH scores AS (
      SELECT player_id, SUM(delta) AS score
      FROM wallet_ledger
      WHERE currency = 'COINS' AND reason = ANY(${PRODUCTION_REASONS})
        AND created_at >= ${start} AND created_at < ${end}
      GROUP BY player_id
    ), ranked AS (
      SELECT player_id AS "playerId", score, RANK() OVER (ORDER BY score DESC) AS rank FROM scores
    )
    SELECT * FROM ranked WHERE "playerId" = ${playerId}::uuid`;
  const r = rows[0];
  return r ? { rank: Number(r.rank), score: BigInt(r.score) } : null;
}

/** Confere a semana anterior uma vez e registra os prêmios de pódio do jogador. */
export async function ensureWeeklyRewards(db: Db, playerId: string, now: Date): Promise<void> {
  const prev = new Date(now.getTime() - WEEK_MS);
  const prevId = weekId(prev);
  const player = await db.player.findUniqueOrThrow({
    where: { id: playerId },
    select: { rewardsCheckedWeek: true },
  });
  if (player.rewardsCheckedWeek === prevId) return;
  const data: {
    playerId: string;
    week: string;
    kind: string;
    rank: number;
    league?: number;
    gems: number;
  }[] = [];
  const general = await weekRank(db, playerId, prev);
  if (general && general.score > 0n && general.rank <= WEEK_PRIZES.length) {
    data.push({
      playerId,
      week: prevId,
      kind: "semana",
      rank: general.rank,
      gems: WEEK_PRIZES[general.rank - 1]!,
    });
  }
  const lw = await db.playerLeagueWeek.findUnique({
    where: { playerId_week: { playerId, week: prevId } },
  });
  if (lw) {
    const standings = await leagueScores(db, prev, lw.league);
    const i = standings.findIndex((r) => r.playerId === playerId);
    const me = standings[i];
    if (me && me.score > 0n && i < LEAGUE_PRIZES.length) {
      data.push({
        playerId,
        week: prevId,
        kind: "liga",
        rank: i + 1,
        league: lw.league,
        gems: podiumPrizes(lw.league).liga[i]!,
      });
    }
  }
  if (data.length > 0) await db.playerWeeklyReward.createMany({ data, skipDuplicates: true });
  await db.player.update({ where: { id: playerId }, data: { rewardsCheckedWeek: prevId } });
}

export async function getWeeklyRewards(db: Db, playerId: string, now: Date) {
  await ensureWeeklyRewards(db, playerId, now);
  const rows = await db.playerWeeklyReward.findMany({
    where: { playerId, claimedAt: null },
    orderBy: [{ week: "asc" }, { kind: "asc" }],
  });
  return {
    pending: rows.map((r) => ({
      week: r.week,
      kind: r.kind,
      rank: r.rank,
      league: r.league === null ? null : LEAGUES[r.league],
      gems: r.gems,
    })),
    serverTime: now.toISOString(),
  };
}

export function claimWeeklyReward(week: string, kind: string, now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const where = { playerId_week_kind: { playerId: wallet.playerId, week, kind } };
    const row = await tx.playerWeeklyReward.findUnique({ where });
    if (!row) throw new AppError(404, "WEEKLY_REWARD_NOT_FOUND", "Prêmio não encontrado");
    if (row.claimedAt) throw new AppError(409, "WEEKLY_REWARD_CLAIMED", "Prêmio já resgatado");
    await applyGems(tx, wallet, BigInt(row.gems), `podium:${kind}:${week}`, idempotencyKey, now);
    await tx.playerWeeklyReward.update({ where, data: { claimedAt: now } });
    await track(tx, wallet.playerId, "podium_claimed", { kind, rank: row.rank });
    return {
      statusCode: 200,
      body: {
        claimed: { week, kind, gems: row.gems },
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}
