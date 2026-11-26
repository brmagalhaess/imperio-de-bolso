// Distritos do mapa, em ordem de desbloqueio (docs/ADRs/0004-direcao-visual-v2.md).
// Para comprar num distrito é preciso possuir todos os negócios do distrito anterior.
// Mapas 5–8 (2026-10-14): Polo Industrial, Serra Nevada, Ilha Paraíso e Centro Espacial.
// Mapas 9–20 (2026-10-25, ADR 0034): outros planetas e cidades engraçadas.
export const DISTRICTS = [
  "praia",
  "cidade",
  "porto",
  "centro",
  "industrial",
  "serra",
  "ilha",
  "espaco",
  "piratas",
  "atlantida",
  "dinos",
  "pinguins",
  "doces",
  "brinquedos",
  "lua",
  "marte",
  "gatos",
  "saturno",
  "gelatina",
  "galaxia",
] as const;
export type District = (typeof DISTRICTS)[number];

export function previousDistrict(district: string): District | null {
  const i = DISTRICTS.indexOf(district as District);
  return i > 0 ? (DISTRICTS[i - 1] ?? null) : null;
}

/**
 * REGRA ANTIGA (até a ADR 0035) — hoje só serve para converter quem já jogava: os mapas que
 * ele tinha abertos continuam abertos (services/progress.ts). Regra: o anterior liberado e completo. Quando um mapa ganha
 * negócios novos (ADR 0034), quem já tinha negócio no mapa seguinte continua com ele aberto —
 * possuir qualquer negócio num mapa o mantém liberado.
 */
export function unlockedDistricts<K>(
  defs: readonly { id: K; district: string }[],
  ownedIds: ReadonlySet<K>,
): Set<District> {
  const open = new Set<District>();
  let prevOk = true;
  for (const d of DISTRICTS) {
    const mine = defs.filter((x) => x.district === d);
    const ownsAny = mine.some((x) => ownedIds.has(x.id));
    if (prevOk || ownsAny) open.add(d);
    prevOk = open.has(d) && mine.length > 0 && mine.every((x) => ownedIds.has(x.id));
  }
  return open;
}
