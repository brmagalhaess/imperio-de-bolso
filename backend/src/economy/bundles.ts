// Pacotes promocionais em dinheiro real (ADR 0024): 10 da rotação semanal (3 por semana, um de
// cada faixa de preço) + 10 temáticos de feriado (a semana do feriado, segunda a segunda no
// horário de Brasília). Cada um pode ser comprado 1 vez enquanto está na vitrine; o Kit
// Iniciante, 1 vez por conta. Conteúdo entregue pelo servidor depois do recibo da loja.

import { weekBounds } from "../lib/time.js";

export interface BundleContents {
  gems: bigint;
  /** Horas somadas à auto-coleta (como a compra de auto-coleta com diamantes). */
  autoCollectHours: number;
  /** Horas somadas ao turbo 2× de produção. */
  turboHours: number;
  /** Horas de produção entregues na hora (coleta antecipada), no mapa atual do jogador. */
  boostHours: number;
}

export interface Bundle extends BundleContents {
  id: string;
  productId: string;
  title: string;
  priceBRL: string;
  /** Ícone no jogo (game/assets/ui/offers/<icon>.png). */
  icon: string;
  kind: "starter" | "weekly" | "holiday";
  /** Faixa da rotação semanal (um de cada por semana). */
  tier?: "low" | "mid" | "high";
}

const P = "br.com.imperiodebolso";
const H = 24;

function b(
  id: string,
  kind: Bundle["kind"],
  title: string,
  priceBRL: string,
  c: Partial<BundleContents>,
  tier?: Bundle["tier"],
): Bundle {
  return {
    id,
    productId: `${P}.bundle_${id}`,
    title,
    priceBRL,
    icon: `offer_${id}`,
    kind,
    tier,
    gems: c.gems ?? 0n,
    autoCollectHours: c.autoCollectHours ?? 0,
    turboHours: c.turboHours ?? 0,
    boostHours: c.boostHours ?? 0,
  };
}

export const BUNDLES: readonly Bundle[] = [
  b("iniciante", "starter", "Kit Iniciante", "9,90", {
    gems: 150n,
    autoCollectHours: H,
    turboHours: 1,
  }),
  b("combo_turbo", "weekly", "Combo Turbo", "14,90", { gems: 120n, turboHours: H }, "low"),
  b(
    "empreendedor",
    "weekly",
    "Kit Empreendedor",
    "19,90",
    { gems: 300n, autoCollectHours: H, turboHours: 4 },
    "low",
  ),
  b(
    "fim_de_semana",
    "weekly",
    "Combo Fim de Semana",
    "24,90",
    { gems: 400n, turboHours: H },
    "low",
  ),
  b(
    "investidor",
    "weekly",
    "Baú do Investidor",
    "29,90",
    { gems: 550n, autoCollectHours: 7 * H },
    "mid",
  ),
  b("express", "weekly", "Império Express", "39,90", { gems: 750n, boostHours: 12 }, "mid"),
  b(
    "mala_de_ouro",
    "weekly",
    "Mala de Ouro",
    "49,90",
    { gems: 1000n, autoCollectHours: 7 * H, turboHours: H },
    "mid",
  ),
  b(
    "magnata",
    "weekly",
    "Cofre do Magnata",
    "99,90",
    { gems: 2200n, autoCollectHours: 14 * H, turboHours: 2 * H },
    "high",
  ),
  b(
    "tesouro_real",
    "weekly",
    "Tesouro Real",
    "249,90",
    { gems: 6000n, autoCollectHours: 30 * H, turboHours: 7 * H },
    "high",
  ),
  b(
    "lenda",
    "weekly",
    "Lenda do Bolso",
    "499,90",
    { gems: 13000n, autoCollectHours: 60 * H, turboHours: 14 * H },
    "high",
  ),
  // Feriados (R$ 29,90 a R$ 99,90).
  b("carnaval", "holiday", "Pacote de Carnaval", "39,90", {
    gems: 750n,
    autoCollectHours: H,
    turboHours: H,
  }),
  b("pascoa", "holiday", "Pacote de Páscoa", "29,90", { gems: 550n, turboHours: H }),
  b("dia_das_maes", "holiday", "Pacote Dia das Mães", "49,90", {
    gems: 1000n,
    autoCollectHours: 7 * H,
  }),
  b("festa_junina", "holiday", "Pacote Festa Junina", "39,90", { gems: 750n, turboHours: 2 * H }),
  b("dia_dos_pais", "holiday", "Pacote Dia dos Pais", "49,90", {
    gems: 1000n,
    autoCollectHours: 7 * H,
  }),
  b("independencia", "holiday", "Pacote da Independência", "39,90", {
    gems: 750n,
    autoCollectHours: 3 * H,
    turboHours: H,
  }),
  b("dia_das_criancas", "holiday", "Pacote Dia das Crianças", "29,90", {
    gems: 600n,
    turboHours: H,
  }),
  b("black_friday", "holiday", "Pacote Black Friday", "99,90", {
    gems: 2600n,
    autoCollectHours: 14 * H,
    turboHours: 3 * H,
  }),
  b("natal", "holiday", "Pacote de Natal", "99,90", {
    gems: 2400n,
    autoCollectHours: 14 * H,
    turboHours: 2 * H,
  }),
  b("ano_novo", "holiday", "Pacote de Ano Novo", "49,90", {
    gems: 1100n,
    autoCollectHours: 7 * H,
    turboHours: H,
  }),
];

export function bundleByProductId(productId: string): Bundle | undefined {
  return BUNDLES.find((x) => x.productId === productId);
}

export function bundleById(id: string): Bundle | undefined {
  return BUNDLES.find((x) => x.id === id);
}

// --- Calendário de feriados (datas no horário de Brasília, "AAAA-MM-DD") --------------------

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function easter(year: number): Date {
  const a = year % 19;
  const b2 = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b2 / 4);
  const e = b2 % 4;
  const f = Math.floor((b2 + 8) / 25);
  const g = Math.floor((b2 - f + 1) / 3);
  const h = (19 * a + b2 - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** n-ésimo dia da semana (0 = domingo) do mês. */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + offset + (n - 1) * 7));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Feriados do ano → id do pacote (dia do feriado, meia-noite UTC do dia civil). */
export function holidays(year: number): { id: string; date: Date }[] {
  const e = easter(year);
  return [
    { id: "ano_novo", date: new Date(Date.UTC(year, 0, 1)) },
    { id: "carnaval", date: new Date(e.getTime() - 47 * DAY_MS) },
    { id: "pascoa", date: e },
    { id: "dia_das_maes", date: nthWeekday(year, 5, 0, 2) },
    { id: "festa_junina", date: new Date(Date.UTC(year, 5, 24)) },
    { id: "dia_dos_pais", date: nthWeekday(year, 8, 0, 2) },
    { id: "independencia", date: new Date(Date.UTC(year, 8, 7)) },
    { id: "dia_das_criancas", date: new Date(Date.UTC(year, 9, 12)) },
    // Black Friday: sexta depois da 4ª quinta de novembro (Ação de Graças nos EUA).
    { id: "black_friday", date: new Date(nthWeekday(year, 11, 4, 4).getTime() + DAY_MS) },
    { id: "natal", date: new Date(Date.UTC(year, 11, 25)) },
  ];
}

/** Meio-dia de Brasília do dia civil → instante dentro desse dia no fuso do jogo. */
function brasiliaNoon(civilDate: Date): Date {
  return new Date(civilDate.getTime() + 15 * 60 * 60 * 1000); // 12:00 BRT = 15:00 UTC
}

/** Pacote de feriado da semana atual (a semana de segunda a segunda que contém o feriado). */
export function holidayBundleFor(now: Date): { bundle: Bundle; end: Date } | null {
  const week = weekBounds(now);
  const y = new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCFullYear();
  for (const year of [y - 1, y, y + 1]) {
    for (const h of holidays(year)) {
      const at = brasiliaNoon(h.date);
      if (at >= week.start && at < week.end) {
        return { bundle: bundleById(h.id)!, end: week.end };
      }
    }
  }
  return null;
}

/** Índice da semana (segundas desde 2026-01-05, uma segunda) — base da rotação. */
export function weekIndex(now: Date): number {
  const base = Date.UTC(2026, 0, 5, 3); // 2026-01-05 00:00 em Brasília
  return Math.floor((weekBounds(now).start.getTime() - base) / (7 * DAY_MS));
}

/** Os 3 pacotes da semana: um barato, um médio e um alto, em rodízio. */
export function weeklyBundles(now: Date): Bundle[] {
  const n = weekIndex(now);
  const tier = (t: Bundle["tier"]) => BUNDLES.filter((x) => x.kind === "weekly" && x.tier === t);
  const mod = (v: number, m: number) => ((v % m) + m) % m;
  const low = tier("low");
  const mid = tier("mid");
  const high = tier("high");
  return [
    low[mod(n, low.length)]!,
    mid[mod(2 * n + 1, mid.length)]!,
    high[mod(n + Math.floor(n / 3), high.length)]!,
  ];
}
