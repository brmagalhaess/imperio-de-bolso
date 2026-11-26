// Ajudantes com nível e especialidade (ADR 0035). Contratar = nível 1 (como sempre: produz
// sozinho com o jogador fora e +25% de velocidade). Do 2 ao 10 cada ajudante reforça a sua
// especialidade:
//   receita — +20% de lucro por nível
//   tempo   — +30 pontos de velocidade por nível
//   noturno — +1 h de produção offline por nível e +8% de lucro por nível
// Preço do nível n = preço do ajudante × 4^(n−1), em moedas.

export const HELPER_MAX_LEVEL = 10;
export const HELPER_KINDS = ["receita", "tempo", "noturno"] as const;
export type HelperKind = (typeof HELPER_KINDS)[number];

export const HELPER_PROFIT_PERCENT = 20;
export const HELPER_SPEED_POINTS = 30;
export const HELPER_NIGHT_HOURS = 1;
export const HELPER_NIGHT_PROFIT_PERCENT = 8;
const COST_GROWTH = 4n;
const HOUR_MS = 60 * 60 * 1000;

export interface HelperSubject {
  businessId: number;
  managerLevel?: number | null;
}

/** Especialidade fixa do ajudante de cada negócio. */
export function helperKind(businessId: number): HelperKind {
  return HELPER_KINDS[((businessId % 3) + 3) % 3]!;
}

/** Níveis acima do 1 (os que dão bônus de especialidade). */
function extra(h: HelperSubject): number {
  return Math.max(0, Math.min(h.managerLevel ?? 0, HELPER_MAX_LEVEL) - 1);
}

/** Bônus de lucro do ajudante, em %. */
export function helperProfitPercent(h: HelperSubject): number {
  const kind = helperKind(h.businessId);
  if (kind === "receita") return HELPER_PROFIT_PERCENT * extra(h);
  if (kind === "noturno") return HELPER_NIGHT_PROFIT_PERCENT * extra(h);
  return 0;
}

/** Pontos de velocidade além dos 25 do ajudante contratado. */
export function helperSpeedPoints(h: HelperSubject): number {
  return helperKind(h.businessId) === "tempo" ? HELPER_SPEED_POINTS * extra(h) : 0;
}

/** Tempo extra de produção offline (ms) além do teto padrão. */
export function helperOfflineExtraMs(h: HelperSubject): number {
  return helperKind(h.businessId) === "noturno" ? HELPER_NIGHT_HOURS * extra(h) * HOUR_MS : 0;
}

/** Aplica o bônus de lucro do ajudante. */
export function withHelper(amount: bigint, h: HelperSubject | undefined): bigint {
  const pct = h ? helperProfitPercent(h) : 0;
  return pct === 0 ? amount : (amount * BigInt(100 + pct)) / 100n;
}

/** Preço para o ajudante chegar ao nível `target` (2–10); null fora da faixa. */
export function helperUpgradeCost(managerCost: bigint, target: number): bigint | null {
  if (!Number.isInteger(target) || target < 2 || target > HELPER_MAX_LEVEL) return null;
  return managerCost * COST_GROWTH ** BigInt(target - 1);
}
