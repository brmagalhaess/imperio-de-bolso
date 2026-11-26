// Calendário do jogo no horário de Brasília (America/Sao_Paulo). Desde 2019 o Brasil não tem
// horário de verão, então o fuso é fixo em UTC−3; se isso mudar, centralize a regra aqui.
const OFFSET_MS = -3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function local(now: Date): Date {
  return new Date(now.getTime() + OFFSET_MS);
}

/** Dia do jogo, "AAAA-MM-DD" (vira à meia-noite de Brasília). */
export function gameDay(now: Date): string {
  return local(now).toISOString().slice(0, 10);
}

/** Início (UTC) do dia do jogo atual e do próximo. */
export function dayBounds(now: Date): { start: Date; end: Date } {
  const l = local(now);
  const startLocal = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
  const start = new Date(startLocal - OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Mês civil de Brasília: dia 1º 00:00 até o dia 1º seguinte (limite mensal do Dobro). */
export function monthBounds(now: Date): { start: Date; end: Date } {
  const l = local(now);
  const start = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - OFFSET_MS);
  const end = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth() + 1, 1) - OFFSET_MS);
  return { start, end };
}

/** Semana do ranking: segunda 00:00 até a segunda seguinte (horário de Brasília). */
export function weekBounds(now: Date): { start: Date; end: Date } {
  const { start: today } = dayBounds(now);
  const weekday = (local(now).getUTCDay() + 6) % 7; // segunda = 0
  const start = new Date(today.getTime() - weekday * DAY_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}
