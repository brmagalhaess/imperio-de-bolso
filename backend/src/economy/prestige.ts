// Prestígio — "Vender o império" (ADR 0011, docs/README.md §4 e §69 V1.1).
// O jogador recomeça da praia e ganha estrelas de investidor: bônus permanente de lucro.

/** Cada estrela soma esta porcentagem ao lucro de todos os negócios. */
export const STAR_BONUS_PERCENT = 2;
/** Escala da fórmula: estrelas = ⌊√(faturamento desde o último prestígio ÷ 1.000.000)⌋. */
export const STAR_SCALE = 1_000_000n;
/** Mapa que precisa estar completo para liberar o prestígio. */
export const PRESTIGE_REQUIRES = "cidade";

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/** Estrelas que o faturamento de produção desde o último prestígio rende. */
export function starsFor(earned: bigint): number {
  if (earned <= 0n) return 0;
  return Number(isqrt(earned / STAR_SCALE));
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
