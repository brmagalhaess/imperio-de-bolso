import { weekBounds } from "../lib/time.js";

// Evento de fim de semana (ADR 0014): de sexta 00:00 a segunda 00:00 (Brasília), o mapa mais
// avançado do jogador rende lucro 2× e há uma meta de faturamento com prêmio em diamantes.

export const EVENT_PROFIT_PERCENT = 100; // +100% = 2×
export const EVENT_PRIZE_GEMS = 20;
/** Meta = faturamento de ~2 h da renda do jogador quando entra no evento. */
export const EVENT_TARGET_SECONDS = 2 * 3600;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface WeekendEvent {
  id: string;
  start: Date;
  end: Date;
}

export function weekendEvent(now: Date): WeekendEvent | null {
  const week = weekBounds(now);
  const start = new Date(week.start.getTime() + 4 * DAY_MS); // sexta
  if (now < start || now >= week.end) return null;
  return { id: `fds-${start.toISOString().slice(0, 10)}`, start, end: week.end };
}
