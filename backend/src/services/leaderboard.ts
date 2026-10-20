import type { Db } from "../db/prisma.js";
import { AppError } from "../errors.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { track } from "./analytics.js";
import { getPlayerState } from "./game.js";
import { gameDay, weekBounds } from "../lib/time.js";
import { PRESTIGE_REASON, PRODUCTION_REASONS } from "./achievements.js";
import { weekIndex } from "../economy/bundles.js";
import { grantBundle } from "./bundles.js";

// Ranking semanal — "Desafio dos 7 dias" da conversa original: quem faturou mais com
// produção na semana (segunda 00:00 → domingo 23:59, horário de Brasília). Quem vende o império
// recomeça do zero: conta só o faturamento depois da última venda dentro da semana.

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
    WITH resets AS (
      SELECT player_id, MAX(created_at) AS at
      FROM wallet_ledger
      WHERE reason = ${PRESTIGE_REASON} AND created_at >= ${start} AND created_at < ${end}
      GROUP BY player_id
    ), scores AS (
      SELECT l.player_id, SUM(l.delta) AS score
      FROM wallet_ledger l LEFT JOIN resets r ON r.player_id = l.player_id
      WHERE l.currency = 'COINS' AND l.reason = ANY(${PRODUCTION_REASONS})
        AND l.created_at >= ${start} AND (r.at IS NULL OR l.created_at > r.at) AND l.created_at < ${end}
      GROUP BY l.player_id
    ), ranked AS (
      SELECT s.player_id AS "playerId", p.display_name AS "displayName", s.score,
             RANK() OVER (ORDER BY s.score DESC) AS rank
      FROM scores s JOIN players p ON p.id = s.player_id
      WHERE NOT p.is_staff
    )
    SELECT * FROM ranked
    WHERE rank <= ${LEADERBOARD_SIZE} OR "playerId" = ${playerId}::uuid
    ORDER BY rank, "displayName"`;
  const view = (r: Row) => ({
    rank: Number(r.rank),
    playerId: r.playerId,
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
    prizes: podiumPrizes((await leagueOf(db, playerId, now)).league, now),
    vip: await vipIds(
      db,
      rows.map((r) => r.playerId),
      now,
    ),
    /** Conta da equipe: aparece para ela mesma como "fora do ranking". */
    staff: await isStaff(db, playerId),
    serverTime: now.toISOString(),
  };
}

async function isStaff(db: Db, playerId: string): Promise<boolean> {
  const p = await db.player.findUnique({ where: { id: playerId }, select: { staff: true } });
  return p?.staff ?? false;
}

/** Quem tem Passe VIP ativo entre os jogadores listados (selo VIP no ranking). */
async function vipIds(db: Db, ids: string[], now: Date): Promise<string[]> {
  if (ids.length === 0) return [];
  const subs = await db.subscription.findMany({
    where: { playerId: { in: ids }, status: "ACTIVE", expiresAt: { gt: now } },
    select: { playerId: true },
    distinct: ["playerId"],
  });
  return subs.map((s) => s.playerId).filter((x): x is string => x !== null);
}

// --- Ligas semanais (ADR 0014; grupos por vendas do império: ADR 0026) ----------
// Bronze → Diamante. Cada semana o jogador disputa com quem está na mesma liga E no mesmo
// grupo de vendas do império (nunca vendeu, 1×, 2× … 5× ou mais — quem vendeu tem bônus de
// lucro permanente, então não disputa com quem ainda não vendeu). O grupo é fixado na primeira
// visita da semana: vender no meio da semana só muda de grupo na semana seguinte, recomeçando
// no Bronze do grupo novo. Na virada, os 20% do topo sobem e os 20% de baixo descem.

export const LEAGUES = ["Bronze", "Prata", "Ouro", "Platina", "Diamante"] as const;
export const LEAGUE_MOVE_SHARE = 0.2;
/** Último grupo de vendas do império (5 = vendeu 5 vezes ou mais). */
export const MAX_BRACKET = 5;
export const bracketOf = (prestigeCount: number) =>
  Math.min(Math.max(prestigeCount, 0), MAX_BRACKET);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const weekId = (now: Date) => gameDay(weekBounds(now).start);

interface ScoreRow {
  playerId: string;
  displayName: string;
  score: bigint;
}

/** Faturamento da semana de quem está na liga `league` naquela semana (0 se não faturou). */
async function leagueScores(
  db: Db,
  week: Date,
  league: number,
  bracket: number,
): Promise<ScoreRow[]> {
  const { start, end } = weekBounds(week);
  return db.$queryRaw<ScoreRow[]>`
    WITH resets AS (
      SELECT player_id, MAX(created_at) AS at
      FROM wallet_ledger
      WHERE reason = ${PRESTIGE_REASON} AND created_at >= ${start} AND created_at < ${end}
      GROUP BY player_id
    )
    SELECT lw.player_id AS "playerId", p.display_name AS "displayName",
           COALESCE(SUM(l.delta), 0)::bigint AS score
    FROM player_league_weeks lw
    JOIN players p ON p.id = lw.player_id
    LEFT JOIN resets r ON r.player_id = lw.player_id
    LEFT JOIN wallet_ledger l ON l.player_id = lw.player_id AND l.currency = 'COINS'
      AND l.reason = ANY(${PRODUCTION_REASONS})
      AND l.created_at >= ${start} AND (r.at IS NULL OR l.created_at > r.at) AND l.created_at < ${end}
    WHERE lw.week = ${weekId(week)} AND lw.league = ${league} AND lw.bracket = ${bracket}
      AND NOT p.is_staff
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

/**
 * Liga e grupo do jogador nesta semana; na primeira visita da semana aplica o resultado da
 * anterior (sobe/desce) — ou, se ele vendeu o império desde então, começa no Bronze do grupo novo.
 */
export async function leagueOf(
  db: Db,
  playerId: string,
  now: Date,
): Promise<{ league: number; bracket: number }> {
  const week = weekId(now);
  const current = await db.playerLeagueWeek.findUnique({
    where: { playerId_week: { playerId, week } },
  });
  if (current) return { league: current.league, bracket: current.bracket };
  const player = await db.player.findUniqueOrThrow({
    where: { id: playerId },
    select: { prestigeCount: true },
  });
  const bracket = bracketOf(player.prestigeCount);
  const last = await db.playerLeagueWeek.findFirst({
    where: { playerId, week: { lt: week } },
    orderBy: { week: "desc" },
  });
  let league = last && last.bracket === bracket ? last.league : 0;
  const prevWeek = new Date(now.getTime() - WEEK_MS);
  if (last && last.bracket === bracket && last.week === weekId(prevWeek)) {
    const standings = await leagueScores(db, prevWeek, last.league, last.bracket);
    const rank = standings.findIndex((r) => r.playerId === playerId) + 1;
    const me = standings[rank - 1];
    const { promote, demote } = leagueMoves(standings.length);
    if (me && me.score > 0n && rank <= promote) league = Math.min(league + 1, LEAGUES.length - 1);
    else if (rank > standings.length - demote) league = Math.max(league - 1, 0);
  }
  await db.playerLeagueWeek.createMany({
    data: [{ playerId, week, league, bracket }],
    skipDuplicates: true,
  });
  const row = await db.playerLeagueWeek.findUniqueOrThrow({
    where: { playerId_week: { playerId, week } },
  });
  return { league: row.league, bracket: row.bracket };
}

export async function getLeague(db: Db, playerId: string, now: Date) {
  const { league: tier, bracket } = await leagueOf(db, playerId, now);
  const standings = await leagueScores(db, now, tier, bracket);
  const view = (r: ScoreRow, i: number) => ({
    rank: i + 1,
    playerId: r.playerId,
    displayName: r.displayName,
    score: r.score.toString(),
    isMe: r.playerId === playerId,
  });
  const all = standings.map(view);
  const { promote, demote } = leagueMoves(standings.length);
  return {
    tier,
    name: LEAGUES[tier],
    /** Grupo por vendas do império: 0 = nunca vendeu … 5 = 5 ou mais. */
    bracket,
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
      FROM players WHERE prestige_stars > 0 AND NOT is_staff
    )
    SELECT * FROM ranked
    WHERE rank <= ${LEADERBOARD_SIZE} OR "playerId" = ${playerId}::uuid
    ORDER BY rank, "displayName"`;
  const view = (r: (typeof rows)[number]) => ({
    rank: Number(r.rank),
    playerId: r.playerId,
    displayName: r.displayName,
    score: String(r.stars),
    isMe: r.playerId === playerId,
  });
  const me = rows.find((r) => r.playerId === playerId);
  return {
    entries: rows.filter((r) => Number(r.rank) <= LEADERBOARD_SIZE).map(view),
    me: me ? view(me) : null,
    staff: await isStaff(db, playerId),
    serverTime: now.toISOString(),
  };
}

// --- Pódio semanal (ADR 0017) ---------------------------------------------------
// Fechada a semana, 1º, 2º e 3º lugar do ranking geral e de cada liga ganham diamantes.
// Conferido na primeira visita da semana seguinte; o jogador resgata pelo aviso no jogo.
// Vender o império zera a pontuação da semana (conta só o faturamento depois da venda).

export const WEEK_PRIZES = [300, 180, 100] as const;
export const LEAGUE_PRIZES = [100, 60, 30] as const;
/** Multiplicador dos prêmios da liga em %: Bronze 1× … Diamante 3×. */
export const LEAGUE_MULT = [100, 150, 200, 250, 300] as const;

/** Bônus do pódio que muda a cada semana (1º, 2º, 3º). "double_gems" = diamantes em dobro. */
export const BONUS_ROTATION = [
  { kind: "turbo", hours: [6, 4, 2] },
  { kind: "auto", hours: [72, 48, 24] },
  { kind: "boost", hours: [12, 8, 4] },
  { kind: "double_gems", hours: [0, 0, 0] },
] as const;

export interface Prize {
  gems: number;
  bonusKind: "turbo" | "auto" | "boost" | null;
  bonusHours: number;
}

export function weekBonus(week: Date) {
  const n = weekIndex(week);
  return BONUS_ROTATION[
    ((n % BONUS_ROTATION.length) + BONUS_ROTATION.length) % BONUS_ROTATION.length
  ]!;
}

/** Prêmios do pódio da semana de `week`: ranking geral e liga (× nível da liga). */
export function podiumPrizes(tier: number, week: Date) {
  const b = weekBonus(week);
  const mk = (gems: number, i: number): Prize =>
    b.kind === "double_gems"
      ? { gems: gems * 2, bonusKind: null, bonusHours: 0 }
      : { gems, bonusKind: b.kind, bonusHours: b.hours[i]! };
  return {
    bonus: b.kind,
    semana: WEEK_PRIZES.map(mk),
    liga: LEAGUE_PRIZES.map((g, i) => mk(Math.round((g * LEAGUE_MULT[tier]!) / 100), i)),
  };
}

async function weekRank(
  db: Db,
  playerId: string,
  week: Date,
): Promise<{ rank: number; score: bigint } | null> {
  const { start, end } = weekBounds(week);
  const rows = await db.$queryRaw<{ playerId: string; score: bigint; rank: bigint }[]>`
    WITH resets AS (
      SELECT player_id, MAX(created_at) AS at
      FROM wallet_ledger
      WHERE reason = ${PRESTIGE_REASON} AND created_at >= ${start} AND created_at < ${end}
      GROUP BY player_id
    ), scores AS (
      SELECT l.player_id, SUM(l.delta) AS score
      FROM wallet_ledger l LEFT JOIN resets r ON r.player_id = l.player_id
      WHERE l.currency = 'COINS' AND l.reason = ANY(${PRODUCTION_REASONS})
        AND l.created_at >= ${start} AND (r.at IS NULL OR l.created_at > r.at) AND l.created_at < ${end}
      GROUP BY l.player_id
    ), ranked AS (
      SELECT s.player_id AS "playerId", s.score, RANK() OVER (ORDER BY s.score DESC) AS rank
      FROM scores s JOIN players p ON p.id = s.player_id
      WHERE NOT p.is_staff
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
    bonusKind: string | null;
    bonusHours: number;
  }[] = [];
  const general = await weekRank(db, playerId, prev);
  if (general && general.score > 0n && general.rank <= WEEK_PRIZES.length) {
    const p = podiumPrizes(0, prev).semana[general.rank - 1]!;
    data.push({
      playerId,
      week: prevId,
      kind: "semana",
      rank: general.rank,
      gems: p.gems,
      bonusKind: p.bonusKind,
      bonusHours: p.bonusHours,
    });
  }
  const lw = await db.playerLeagueWeek.findUnique({
    where: { playerId_week: { playerId, week: prevId } },
  });
  if (lw) {
    const standings = await leagueScores(db, prev, lw.league, lw.bracket);
    const i = standings.findIndex((r) => r.playerId === playerId);
    const me = standings[i];
    if (me && me.score > 0n && i < LEAGUE_PRIZES.length) {
      const p = podiumPrizes(lw.league, prev).liga[i]!;
      data.push({
        playerId,
        week: prevId,
        kind: "liga",
        rank: i + 1,
        league: lw.league,
        gems: p.gems,
        bonusKind: p.bonusKind,
        bonusHours: p.bonusHours,
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
      bonusKind: r.bonusKind,
      bonusHours: r.bonusHours,
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
    // Diamantes + o bônus da semana (Turbo / auto-coleta / coleta antecipada no melhor mapa).
    const h = row.bonusHours;
    const { coins } = await grantBundle(
      tx,
      wallet,
      {
        id: "podium",
        gems: BigInt(row.gems),
        turboHours: row.bonusKind === "turbo" ? h : 0,
        autoCollectHours: row.bonusKind === "auto" ? h : 0,
        boostHours: row.bonusKind === "boost" ? h : 0,
      },
      undefined,
      idempotencyKey,
      now,
      `podium:${kind}:${week}`,
    );
    await tx.playerWeeklyReward.update({ where, data: { claimedAt: now } });
    await track(tx, wallet.playerId, "podium_claimed", { kind, rank: row.rank });
    return {
      statusCode: 200,
      body: {
        claimed: {
          week,
          kind,
          gems: row.gems,
          bonusKind: row.bonusKind,
          bonusHours: row.bonusHours,
          ...(coins > 0n ? { coins: coins.toString() } : {}),
        },
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}
