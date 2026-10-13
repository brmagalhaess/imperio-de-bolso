import type { Db } from "../db/prisma.js";
import { weekBounds } from "../lib/time.js";
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
    serverTime: now.toISOString(),
  };
}
