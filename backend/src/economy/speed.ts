// Aceleradores de produção (pedido do titular em 2026-10-14, ADR 0013). Tudo soma:
//   velocidade = 100% + ajudante 25% + 50% por marco de nível (10, 25, 50, 75, 100)
//              + Passe VIP 50% + Turbo da Loja 100% (2×)
// O ciclo efetivo = ciclo base ÷ velocidade. A produção é medida em "trabalho" (ms do ciclo
// base): 1 s real com velocidade 200% rende 2 s de trabalho. Assim, se o Turbo ou o VIP
// acabam no meio do tempo fora, cada trecho conta com a velocidade que tinha.

import { helperSpeedPoints } from "./helpers.js";

export const HELPER_SPEED = 25;
export const MILESTONE_SPEED = 50;
export const MILESTONES = [10, 25, 50, 75, 100] as const;
export const VIP_SPEED = 50;
export const TURBO_SPEED = 100;
/** Ciclo efetivo nunca fica abaixo disto (evita coleta "metralhadora"). */
export const MIN_CYCLE_MS = 1_000;

export interface SpeedContext {
  vipUntil: Date | null;
  /** Turbo vale de turboFrom (inclusive) até turboUntil. */
  turboFrom?: Date | null;
  turboUntil: Date | null;
  /**
   * Dobro de moedas (ADR 0025): NÃO mexe na velocidade — cada coleta nesse intervalo paga ×2
   * (ver `doubleActive`/`doubledCycles` em services/game.ts). O Turbo é que acelera.
   */
  doubleFrom?: Date | null;
  doubleUntil?: Date | null;
}

/** Dobro de moedas: cada coleta paga ×2 (a velocidade continua a mesma). */
export const DOUBLE_FACTOR = 2n;

export function doubleActive(ctx: SpeedContext, t: number): boolean {
  return windowActive(ctx.doubleFrom, ctx.doubleUntil, t);
}

function windowActive(from: Date | null | undefined, until: Date | null | undefined, t: number) {
  if (!until || until.getTime() <= t) return false;
  return !from || from.getTime() <= t;
}

function turboActive(ctx: SpeedContext, t: number): boolean {
  return windowActive(ctx.turboFrom, ctx.turboUntil, t);
}

export interface SpeedSubject {
  level: number;
  managerUnlocked: boolean;
  /** Nível e negócio do ajudante (ADR 0035): os de especialidade "tempo" aceleram mais. */
  managerLevel?: number | null;
  businessId?: number;
}

/** Marcos de nível atingidos (0–5). */
export function milestonesReached(level: number): number {
  return MILESTONES.filter((m) => level >= m).length;
}

/** Bônus que não dependem do tempo (nível e ajudante), em pontos percentuais. */
export function baseSpeedPercent(b: SpeedSubject): number {
  return (
    100 +
    (b.managerUnlocked ? HELPER_SPEED : 0) +
    (b.managerUnlocked && b.businessId !== undefined
      ? helperSpeedPoints({ businessId: b.businessId, managerLevel: b.managerLevel })
      : 0) +
    MILESTONE_SPEED * milestonesReached(b.level)
  );
}

/** Velocidade total num instante (inclui VIP e Turbo ativos). */
export function speedPercentAt(b: SpeedSubject, ctx: SpeedContext, at: Date): number {
  const t = at.getTime();
  return (
    baseSpeedPercent(b) +
    (ctx.vipUntil && ctx.vipUntil.getTime() > t ? VIP_SPEED : 0) +
    (turboActive(ctx, t) ? TURBO_SPEED : 0)
  );
}

/** Duração real (ms) de um ciclo com a velocidade dada. */
export function effectiveCycleMs(cycleSeconds: number, speedPercent: number): number {
  return Math.max(MIN_CYCLE_MS, Math.round((cycleSeconds * 1000 * 100) / speedPercent));
}

/** Trabalho (ms de ciclo base) feito entre dois instantes, trecho a trecho. */
export function workBetween(
  b: SpeedSubject,
  ctx: SpeedContext,
  fromMs: number,
  toMs: number,
): number {
  if (toMs <= fromMs) return 0;
  const cuts = [ctx.vipUntil, ctx.turboFrom, ctx.turboUntil]
    .map((d) => d?.getTime())
    .filter((t): t is number => t !== undefined && t > fromMs && t < toMs)
    .sort((a, b) => a - b);
  let work = 0;
  let start = fromMs;
  for (const end of [...cuts, toMs]) {
    work += ((end - start) * speedPercentAt(b, ctx, new Date(start))) / 100;
    start = end;
  }
  return Math.floor(work);
}
