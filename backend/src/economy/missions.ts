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
  | "ad_watched"
  | "evolve_count"
  | "helper_upgrade"
  | "mission_claimed";

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
  /** Preço da evolução de ajudante mais barata (ADR 0035), ou null se não há. */
  cheapestHelperUp?: number | null;
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
  if (ctx.ownedCount < 6) return 0;
  if (ctx.ownedCount < 18) return 1;
  if (ctx.ownedCount < 30) return 2;
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

// Missões novas da ADR 0035 (entram no fim da lista: o sorteio é por hash do id).
(MISSION_TEMPLATES as MissionTemplate[]).push(
  {
    id: "helper_up",
    metric: "helper_upgrade",
    title: "Evolua {n} ajudante",
    target: () => 1n,
    eligible: (c) => c.hasHelper && reachable(c.cheapestHelperUp, c),
  },
  {
    id: "upgrade_many",
    metric: "upgrade_count",
    group: "upgrade",
    title: "Suba {n} níveis nos seus negócios",
    target: byTier([10n, 30n, 60n, 100n]),
    eligible: (c) => missionTier(c) >= 1,
  },
  {
    id: "collect_marathon",
    metric: "collect_count",
    group: "collect",
    title: "Maratona: colete moedas {n} vezes",
    target: byTier([25n, 50n, 80n, 120n]),
    eligible: (c) => (c.manualCount ?? c.ownedCount) > 0 && missionTier(c) >= 1,
  },
);

// --- Desafios da semana (ADR 0035) -----------------------------------------------
// Três por semana (segunda a domingo), alvos maiores e prêmio em diamantes. Ficam na mesma
// tabela das missões, com `day` = "S" + segunda-feira da semana.

export const CHALLENGES_PER_WEEK = 3;
export const CHALLENGE_REWARD_GEMS = 8;
export const CHALLENGE_PREFIX = "w_";

export const CHALLENGE_TEMPLATES: readonly MissionTemplate[] = [
  {
    id: "w_evolve",
    metric: "evolve_count",
    title: "Faça {n} evoluções de negócios",
    target: byTier([2n, 4n, 6n, 8n]),
    eligible: (c) => c.ownedCount > 0,
  },
  {
    id: "w_upgrade",
    metric: "upgrade_count",
    title: "Suba {n} níveis nos seus negócios",
    target: byTier([60n, 150n, 250n, 400n]),
    eligible: (c) => c.ownedCount > 0,
  },
  {
    id: "w_helper",
    metric: "helper_upgrade",
    title: "Evolua ajudantes {n} vezes",
    target: byTier([2n, 4n, 6n, 8n]),
    eligible: (c) => c.hasHelper,
  },
  {
    id: "w_earn",
    metric: "coins_earned",
    title: "Fature {n} moedas na semana",
    target: (c) => niceRound(Math.max(5000, c.incomePerSecond * 8 * 3600)),
    eligible: () => true,
  },
  {
    id: "w_collect",
    metric: "collect_count",
    title: "Colete moedas {n} vezes",
    target: byTier([100n, 200n, 300n, 400n]),
    eligible: (c) => (c.manualCount ?? c.ownedCount) > 0 || c.ownedCount === 0,
  },
  {
    id: "w_missions",
    metric: "mission_claimed",
    title: "Conclua {n} missões do dia",
    target: () => 12n,
    eligible: () => true,
  },
  {
    id: "w_ads",
    metric: "ad_watched",
    title: "Assista {n} anúncios da Loja",
    target: () => 15n,
    eligible: (c) => c.ownedCount > 0 && features.ads,
  },
  {
    id: "w_afk",
    metric: "afk_collect",
    title: "Receba {n} vezes os ganhos dos ajudantes",
    target: () => 7n,
    eligible: (c) => c.hasHelper,
  },
];

/** Sorteio estável dos desafios da semana (mesmo jogador e semana → mesmos desafios). */
export function pickWeeklyChallenges(playerId: string, week: string, ctx: MissionContext) {
  return CHALLENGE_TEMPLATES.filter((t) => t.eligible(ctx))
    .map((t) => ({
      t,
      h: createHash("sha256").update(`${playerId}|${week}|${t.id}`).digest("hex"),
    }))
    .sort((a, b) => (a.h < b.h ? -1 : 1))
    .slice(0, CHALLENGES_PER_WEEK)
    .map((x) => x.t);
}

/** Prêmio em moedas do desafio: ~1 h da renda atual, até o preço do próximo negócio. */
export function challengeRewardCoins(ctx: MissionContext): bigint {
  return niceRound(Math.min(Math.max(200, ctx.incomePerSecond * 3600), rewardCap(ctx.cheapestBuy)));
}

export const MISSIONS_PER_DAY = 3;
export const MISSION_REWARD_GEMS = 1;

/**
 * Teto dos prêmios em moedas (missões e calendário): o preço do próximo negócio a construir.
 * Quem vendeu o império volta ao 1º mapa com a renda multiplicada pelas estrelas; sem o teto,
 * 15 min dessa renda pagavam vários negócios de uma vez e o recomeço perdia a graça.
 * Império completo (nada para construir): sem teto.
 */
export function rewardCap(cheapestBuy: number | null | undefined): number {
  return cheapestBuy === null || cheapestBuy === undefined ? Infinity : Math.max(50, cheapestBuy);
}

/** Prêmio em moedas: ~15 min da renda atual (mín. 50), até o preço do próximo negócio. */
export function missionRewardCoins(ctx: MissionContext): bigint {
  return niceRound(Math.min(Math.max(50, ctx.incomePerSecond * 900), rewardCap(ctx.cheapestBuy)));
}

/**
 * Escolhe as missões do dia: iniciante sempre recebe "colete N vezes" (aprende o básico); os
 * demais, um sorteio estável (mesmo jogador e mesmo dia → mesmas missões) entre as elegíveis,
 * no máximo uma por grupo.
 */
export function pickDailyMissions(
  playerId: string,
  day: string,
  ctx: MissionContext,
  /** Missões de hoje que ficam (já resgatadas): não repete o modelo nem o grupo delas. */
  keep: readonly MissionTemplate[] = [],
) {
  const kept = new Set(keep.map((t) => t.id));
  const eligible = MISSION_TEMPLATES.filter((t) => t.eligible(ctx) && !kept.has(t.id));
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
  const groups = new Set<string>(keep.flatMap((t) => (t.group ? [t.group] : [])));
  for (const t of [...fixed, ...rest]) {
    if (picked.length + keep.length >= MISSIONS_PER_DAY) break;
    if (t.group && groups.has(t.group)) continue;
    if (t.group) groups.add(t.group);
    picked.push(t);
  }
  return picked;
}

export function templateById(id: string): MissionTemplate | undefined {
  return [...MISSION_TEMPLATES, ...CHALLENGE_TEMPLATES].find((t) => t.id === id);
}
