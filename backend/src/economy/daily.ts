// Calendário de 7 dias (ADR 0014): um prêmio por dia de jogo; perder um dia volta ao dia 1.
// Moedas em minutos de renda (crescem com o jogador), com um mínimo.

export interface DailyRewardDef {
  day: number;
  coinsMinutes?: number;
  minCoins?: bigint;
  gems?: number;
  turboMinutes?: number;
}

export const DAILY_REWARDS: readonly DailyRewardDef[] = [
  { day: 1, coinsMinutes: 10, minCoins: 200n },
  { day: 2, gems: 5 },
  { day: 3, coinsMinutes: 30, minCoins: 1_000n },
  { day: 4, turboMinutes: 60 },
  { day: 5, gems: 10 },
  { day: 6, coinsMinutes: 60, minCoins: 5_000n },
  { day: 7, gems: 25, turboMinutes: 120 },
];

/** Baú das missões: abre quando as 3 missões do dia foram resgatadas. */
export const MISSION_CHEST = { gems: 5, turboMinutes: 30 } as const;
