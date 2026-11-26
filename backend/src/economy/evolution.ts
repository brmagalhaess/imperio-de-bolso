// Evolução dos negócios (ADR 0035). Cada negócio tem 5 evoluções, pelas faixas de nível que já
// trocavam a arte: 1–9, 10–24, 25–49, 50–99 e 100. Cada evolução vale 1 estrela de evolução e
// triplica o lucro do negócio — é o que torna viável levar o mapa inteiro ao nível máximo, a
// condição para liberar o mapa seguinte.

export const EVOLUTION_LEVELS = [1, 10, 25, 50, 100] as const;
export const MAX_EVOLUTION = EVOLUTION_LEVELS.length;
/** Lucro × 3 a cada evolução (2ª = 3×, 3ª = 9×, 4ª = 27×, 5ª = 81×). */
export const EVOLUTION_PROFIT_FACTOR = 3n;

/** Evolução (1–5) de um negócio no nível dado; 0 para nível inválido/não comprado. */
export function evolutionOf(level: number): number {
  return EVOLUTION_LEVELS.filter((l) => level >= l).length;
}

/** Multiplicador de lucro da evolução do nível. */
export function evolutionMult(level: number): bigint {
  return EVOLUTION_PROFIT_FACTOR ** BigInt(Math.max(0, evolutionOf(level) - 1));
}

/** Nível em que acontece a próxima evolução; null na última. */
export function nextEvolutionLevel(level: number): number | null {
  return EVOLUTION_LEVELS.find((l) => l > level) ?? null;
}
