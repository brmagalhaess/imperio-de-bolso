// Prestígio — "Vender o império" (ADR 0011, docs/README.md §4 e §69 V1.1).
// O jogador recomeça da praia e ganha estrelas de investidor: bônus permanente de lucro.

/** Cada estrela soma esta porcentagem ao lucro de todos os negócios. */
export const STAR_BONUS_PERCENT = 2;
/**
 * Estrelas por venda = ⌊20 × log10(faturamento desde a última venda ÷ 1.000.000)⌋, mínimo 0.
 * Logarítmica (simulação de 2026-10-15): com a raiz quadrada o bônus explodia (+15.000% no
 * 14º dia), porque o faturamento cresce em ordens de grandeza a cada mapa. Agora cada mapa a
 * mais vale ~+20 estrelas, e as vendas seguidas somam estrelas em vez de multiplicar.
 *   1 milhão → 0 · 1 bilhão → 60 (+120%) · 1 trilhão → 120 (+240%) · 1 aa → 180 (+360%)
 */
export const STAR_SCALE = 1_000_000n;
export const STARS_PER_DECADE = 20;
/**
 * Requisito para vender (revisão 2026-10-15): o império completo — todos os negócios e todos os
 * ajudantes. Com os 20 mapas (ADR 0034) vale o império da Terra: os 8 primeiros mapas (até o
 * Centro Espacial) — senão a venda ficaria a meses. Quem vai além vende com mais estrelas, porque
 * elas vêm do faturamento. Desde a ADR 0035 (pedido do titular) todos esses negócios
 * também precisam estar no nível máximo (100).
 */
export const PRESTIGE_REQUIRES = "imperio_completo";
export const PRESTIGE_MAPS = 8;

/** Estrelas que o faturamento de produção desde o último prestígio rende. */
export function starsFor(earned: bigint): number {
  if (earned <= STAR_SCALE) return 0;
  const ratio = earned / STAR_SCALE;
  // log10 com precisão suficiente: dígitos inteiros + mantissa dos 15 primeiros dígitos.
  const digits = ratio.toString();
  const head = Number(digits.slice(0, 15));
  const log10 = digits.length - Math.min(15, digits.length) + Math.log10(head);
  return Math.max(0, Math.floor(STARS_PER_DECADE * log10 + 1e-9));
}

/** Bônus total em % para `stars` estrelas. */
export function bonusPercent(stars: number): number {
  return stars * STAR_BONUS_PERCENT;
}

/** Aplica o bônus das estrelas a um lucro (inteiro, arredondado para baixo). */
export function withPrestige(amount: bigint, stars: number): bigint {
  if (stars <= 0) return amount;
  return (amount * BigInt(100 + bonusPercent(stars))) / 100n;
}
