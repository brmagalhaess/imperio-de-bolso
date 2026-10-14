import { createHash } from "node:crypto";
import { features } from "../lib/features.js";

// Missões diárias (docs/README.md §3: três por dia). Catálogo em código, versionado no Git.
// Cada missão mede uma métrica que o servidor incrementa ao processar comandos.

export type MissionMetric =
  | "collect_count"
  | "upgrade_count"
  | "coins_earned"
  | "hire_count"
  | "purchase_count"
  | "afk_collect"
  | "visit_cidade"
  | "ad_watched";

export interface MissionContext {
  /** Renda potencial por segundo (lucro do ciclo ÷ duração, negócios comprados). */
  incomePerSecond: number;
  ownedCount: number;
  canBuy: boolean; // há negócio liberado ainda não construído
  canHire: boolean; // há negócio comprado sem ajudante
  hasHelper: boolean;
  cityUnlocked: boolean;
  /** Negócios com moeda para tocar (sem auto-coleta, os com ajudante também contam). */
  manualCount?: number;
  /** Preço do negócio liberado mais barato ainda não construído / do ajudante mais barato. */
  cheapestBuy?: number | null;
  cheapestHire?: number | null;
  coins?: number;
}

export interface MissionTemplate {
  id: string;
  metric: MissionMetric;
  /** Título com {n} para o alvo. */
  title: string;
  /** Missões do mesmo grupo não saem no mesmo dia (ex.: duas de faturar). */
  group?: string;
  target: (ctx: MissionContext) => bigint;
  eligible: (ctx: MissionContext) => boolean;
}

/** Arredonda para 2 algarismos significativos ("números bonitos" nos alvos e prêmios). */
export function niceRound(value: number): bigint {
  if (value < 10) return BigInt(Math.max(1, Math.round(value)));
  const mag = 10 ** (Math.floor(Math.log10(value)) - 1);
  return BigInt(Math.round(value / mag) * mag);
}

/**
 * Fase do jogador pelo número de negócios: 0 iniciante (praia), 1 cidade, 2 porto, 3 centro.
 * Alvos crescem com a fase (pedido do titular: missão de iniciante não faz sentido para quem
 * já evoluiu).
 */
export function missionTier(ctx: MissionContext): number {
  if (ctx.ownedCount < 4) return 0;
  if (ctx.ownedCount < 10) return 1;
  if (ctx.ownedCount < 16) return 2;
  return 3;
}

const byTier =
  (values: readonly bigint[]) =>
  (c: MissionContext): bigint =>
    values[Math.min(missionTier(c), values.length - 1)] ?? 1n;

/** Dá para alcançar hoje: já tem o dinheiro ou junta em até 30 min de renda. */
const reachable = (price: number | null | undefined, c: MissionContext) =>
  price !== null &&
  price !== undefined &&
  price <= Math.max(c.coins ?? 0, c.incomePerSecond * 1800);

export const MISSION_TEMPLATES: readonly MissionTemplate[] = [
  {
    id: "collect_times",
    metric: "collect_count",
    title: "Colete moedas {n} vezes",
    target: byTier([10n, 20n, 40n, 60n]),
    eligible: (c) => (c.manualCount ?? c.ownedCount) > 0 || c.ownedCount === 0,
  },
  {
    id: "earn_coins",
    metric: "coins_earned",
    group: "earn",
    title: "Fature {n} moedas",
    target: (c) => niceRound(Math.max(100, c.incomePerSecond * 600)),
    eligible: () => true,
  },
  {
    id: "earn_big",
    metric: "coins_earned",
    group: "earn",
    title: "Fature {n} moedas",
    target: (c) => niceRound(Math.max(1000, c.incomePerSecond * 3600)),
    eligible: (c) => missionTier(c) >= 1,
  },
  {
    id: "upgrade_times",
    metric: "upgrade_count",
    title: "Melhore negócios {n} vezes",
    target: byTier([5n, 15n, 30n, 50n]),
    eligible: (c) => c.ownedCount > 0,
  },
  {
    id: "buy_business",
    metric: "purchase_count",
    title: "Construa {n} negócio novo",
    target: () => 1n,
    eligible: (c) => c.canBuy && (c.cheapestBuy === undefined || reachable(c.cheapestBuy, c)),
  },
  {
    id: "hire_helper",
    metric: "hire_count",
    title: "Contrate {n} ajudante",
    target: () => 1n,
    eligible: (c) => c.canHire && (c.cheapestHire === undefined || reachable(c.cheapestHire, c)),
  },
  {
    id: "afk_collect",
    metric: "afk_collect",
    title: "Receba {n} vez os ganhos dos ajudantes",
    target: () => 1n,
    eligible: (c) => c.hasHelper,
  },
  {
    id: "visit_city",
    metric: "visit_cidade",
    title: "Visite a Cidade {n} vez",
    target: () => 1n,
    eligible: (c) => c.cityUnlocked && missionTier(c) <= 1,
  },
  {
    id: "watch_ads",
    metric: "ad_watched",
    title: "Assista {n} anúncios da Loja",
    target: () => 2n,
    eligible: (c) => c.ownedCount > 0 && features.ads,
  },
];

export const MISSIONS_PER_DAY = 3;
export const MISSION_REWARD_GEMS = 1;

/** Prêmio em moedas: ~15 min da renda atual, no mínimo 50. */
export function missionRewardCoins(ctx: MissionContext): bigint {
  return niceRound(Math.max(50, ctx.incomePerSecond * 900));
}

/**
 * Escolhe as missões do dia: iniciante sempre recebe "colete N vezes" (aprende o básico); os
 * demais, um sorteio estável (mesmo jogador e mesmo dia → mesmas missões) entre as elegíveis,
 * no máximo uma por grupo.
 */
export function pickDailyMissions(playerId: string, day: string, ctx: MissionContext) {
  const eligible = MISSION_TEMPLATES.filter((t) => t.eligible(ctx));
  const fixedId = missionTier(ctx) === 0 ? "collect_times" : null;
  const fixed = eligible.filter((t) => t.id === fixedId);
  const rest = eligible
    .filter((t) => t.id !== fixedId)
    .map((t) => ({
      t,
      h: createHash("sha256").update(`${playerId}|${day}|${t.id}`).digest("hex"),
    }))
    .sort((a, b) => (a.h < b.h ? -1 : 1))
    .map((x) => x.t);
  const picked: MissionTemplate[] = [];
  const groups = new Set<string>();
  for (const t of [...fixed, ...rest]) {
    if (picked.length >= MISSIONS_PER_DAY) break;
    if (t.group && groups.has(t.group)) continue;
    if (t.group) groups.add(t.group);
    picked.push(t);
  }
  return picked;
}

export function templateById(id: string): MissionTemplate | undefined {
  return MISSION_TEMPLATES.find((t) => t.id === id);
}
