// Distritos do mapa, em ordem de desbloqueio (docs/ADRs/0004-direcao-visual-v2.md).
// Para comprar num distrito é preciso possuir todos os negócios do distrito anterior.
export const DISTRICTS = ["praia", "cidade", "porto", "centro"] as const;
export type District = (typeof DISTRICTS)[number];

export function previousDistrict(district: string): District | null {
  const i = DISTRICTS.indexOf(district as District);
  return i > 0 ? (DISTRICTS[i - 1] ?? null) : null;
}
