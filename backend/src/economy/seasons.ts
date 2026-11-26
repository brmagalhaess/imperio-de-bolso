// Temporada de 20 dias (ADR 0035): ranking global por estrelas de evolução ganhas na temporada,
// desempate pelo faturamento de produção no mesmo período. Prêmios em diamantes no fim.

const DAY_MS = 24 * 60 * 60 * 1000;
export const SEASON_DAYS = 20;
/** Início da temporada 1: 25/11/2026 00:00 de Brasília. */
export const SEASON_EPOCH = new Date("2026-11-25T03:00:00.000Z");

export interface Season {
  number: number;
  start: Date;
  end: Date;
}

export function seasonAt(now: Date): Season {
  const span = SEASON_DAYS * DAY_MS;
  const n = Math.max(0, Math.floor((now.getTime() - SEASON_EPOCH.getTime()) / span));
  const start = new Date(SEASON_EPOCH.getTime() + n * span);
  return { number: n + 1, start, end: new Date(start.getTime() + span) };
}

export function seasonByNumber(number: number): Season {
  const span = SEASON_DAYS * DAY_MS;
  const start = new Date(SEASON_EPOCH.getTime() + (number - 1) * span);
  return { number, start, end: new Date(start.getTime() + span) };
}

/** Faixas de prêmio: até a posição `upTo` ganha `gems` diamantes. */
export const SEASON_PRIZES = [
  { upTo: 1, gems: 1000 },
  { upTo: 2, gems: 600 },
  { upTo: 3, gems: 400 },
  { upTo: 10, gems: 200 },
  { upTo: 50, gems: 80 },
] as const;
/** Quem ganhou pelo menos estas estrelas na temporada leva o prêmio de participação. */
export const SEASON_PARTICIPATION_STARS = 10;
export const SEASON_PARTICIPATION_GEMS = 20;

export function seasonPrize(rank: number, stars: number): number {
  const tier = SEASON_PRIZES.find((p) => rank <= p.upTo);
  if (tier && stars > 0) return tier.gems;
  return stars >= SEASON_PARTICIPATION_STARS ? SEASON_PARTICIPATION_GEMS : 0;
}
