// Distritos do mapa, em ordem de desbloqueio (docs/ADRs/0004-direcao-visual-v2.md).
// Para comprar num distrito é preciso possuir todos os negócios do distrito anterior.
// Mapas 5–8 (pedido do titular em 2026-10-14): Polo Industrial, Serra Nevada, Ilha Paraíso e
// Centro Espacial.
export const DISTRICTS = [
  "praia",
  "cidade",
  "porto",
  "centro",
  "industrial",
  "serra",
  "ilha",
  "espaco",
] as const;
export type District = (typeof DISTRICTS)[number];

export function previousDistrict(district: string): District | null {
  const i = DISTRICTS.indexOf(district as District);
  return i > 0 ? (DISTRICTS[i - 1] ?? null) : null;
}
