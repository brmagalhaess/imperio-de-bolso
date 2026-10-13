import { createHash } from "node:crypto";

// Missões diárias (docs/README.md §3: três por dia). Catálogo em código, versionado no Git.
// Cada missão mede uma métrica que o servidor incrementa ao processar comandos.

export type MissionMetric =
  | "collect_count"
  | "upgrade_count"
  | "coins_earned"
  | "hire_count"
  | "purchase_count"
  | "afk_collect"
  | "visit_cidade";

export interface MissionContext {
  /** Renda potencial por segundo (lucro do ciclo ÷ duração, negócios comprados). */
  incomePerSecond: number;
  ownedCount: number;
  canBuy: boolean; // há negócio liberado ainda não construído
  canHire: boolean; // há negócio comprado sem ajudante
  hasHelper: boolean;
  cityUnlocked: boolean;
}

export interface MissionTemplate {
  id: string;
  metric: MissionMetric;
  /** Título com {n} para o alvo. */
  title: string;
  target: (ctx: MissionContext) => bigint;
  eligible: (ctx: MissionContext) => boolean;
}

/** Arredonda para 2 algarismos significativos ("números bonitos" nos alvos e prêmios). */
export function niceRound(value: number): bigint {
  if (value < 10) return BigInt(Math.max(1, Math.round(value)));
  const mag = 10 ** (Math.floor(Math.log10(value)) - 1);
  return BigInt(Math.round(value / mag) * mag);
}

export const MISSION_TEMPLATES: readonly MissionTemplate[] = [
  {
    id: "collect_times",
    metric: "collect_count",
    title: "Colete moedas {n} vezes",
    target: () => 10n,
    eligible: (c) => c.ownedCount > 0 || c.canBuy,
  },
  {
    id: "earn_coins",
    metric: "coins_earned",
    title: "Fature {n} moedas",
    target: (c) => niceRound(Math.max(100, c.incomePerSecond * 600)),
    eligible: () => true,
  },
  {
    id: "upgrade_times",
    metric: "upgrade_count",
    title: "Melhore negócios {n} vezes",
    target: () => 5n,
    eligible: (c) => c.ownedCount > 0,
  },
  {
    id: "buy_business",
    metric: "purchase_count",
    title: "Construa {n} negócio novo",
    target: () => 1n,
    eligible: (c) => c.canBuy,
  },
  {
    id: "hire_helper",
    metric: "hire_count",
    title: "Contrate {n} ajudante",
    target: () => 1n,
    eligible: (c) => c.canHire,
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
    eligible: (c) => c.cityUnlocked,
  },
];

export const MISSIONS_PER_DAY = 3;
export const MISSION_REWARD_GEMS = 1;

/** Prêmio em moedas: ~15 min da renda atual, no mínimo 50. */
export function missionRewardCoins(ctx: MissionContext): bigint {
  return niceRound(Math.max(50, ctx.incomePerSecond * 900));
}

/**
 * Escolhe as missões do dia: sempre "colete N vezes" (se elegível) + sorteio estável
 * (mesmo jogador e mesmo dia → mesmas missões) entre as demais elegíveis.
 */
export function pickDailyMissions(playerId: string, day: string, ctx: MissionContext) {
  const eligible = MISSION_TEMPLATES.filter((t) => t.eligible(ctx));
  const fixed = eligible.filter((t) => t.id === "collect_times");
  const rest = eligible
    .filter((t) => t.id !== "collect_times")
    .map((t) => ({
      t,
      h: createHash("sha256").update(`${playerId}|${day}|${t.id}`).digest("hex"),
    }))
    .sort((a, b) => (a.h < b.h ? -1 : 1))
    .map((x) => x.t);
  return [...fixed, ...rest].slice(0, MISSIONS_PER_DAY);
}

export function templateById(id: string): MissionTemplate | undefined {
  return MISSION_TEMPLATES.find((t) => t.id === id);
}
