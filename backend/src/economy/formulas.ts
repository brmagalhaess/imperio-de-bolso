// Fórmulas de economia (docs/README.md §6). Configuráveis via catálogo;
// os multiplicadores ficam aqui até existir game_config_versions.

import { withPrestige } from "./prestige.js";

export const UPGRADE_COST_GROWTH = 1.15;
/** 1,10 desde 2026-10-15 (era 1,12): com mapas de 9 negócios o império completo leva ~2–4
 * semanas em vez de ~1–2 (simulação em scripts/simulate-player.ts). */
export const REVENUE_GROWTH = 1.1;

export interface EconomyDefinition {
  cost: bigint;
  revenue: bigint;
  operatingCost: bigint;
  maxLevel: number;
}

/**
 * Teto de qualquer valor econômico (ADR 0033): as colunas são NUMERIC(65,0) e o jogo usa
 * números decimais sem limite (scripts/big.gd); 10^60 deixa folga para somar.
 */
export const MAX_ECONOMY_VALUE = 10n ** 60n;

// Crescimentos como frações exatas (1,15 = 23/20; 1,10 = 11/10): conta inteira, sem perda de
// precisão do float acima de 2^53 (os mapas novos passam disso no nível 100).
const COST_NUM = 23n;
const COST_DEN = 20n;
const REVENUE_NUM = 11n;
const REVENUE_DEN = 10n;

/** round(base × (num/den)^exp) em inteiros (meio arredonda para cima, como Math.round). */
function grow(base: bigint, num: bigint, den: bigint, exp: number): bigint {
  const n = BigInt(exp);
  const top = base * num ** n;
  const bottom = den ** n;
  const value = (top * 2n + bottom) / (bottom * 2n);
  if (value > MAX_ECONOMY_VALUE) {
    throw new RangeError(`valor econômico fora da faixa segura: ${value}`);
  }
  return value;
}

function assertLevel(level: number, maxLevel: number): void {
  if (!Number.isInteger(level) || level < 1 || level > maxLevel) {
    throw new RangeError(`nível inválido: ${level} (máximo ${maxLevel})`);
  }
}

/** Custo para chegar ao nível `targetLevel`: round(base × 1,15^(n−1)). */
export function upgradeCostTo(def: EconomyDefinition, targetLevel: number): bigint {
  assertLevel(targetLevel, def.maxLevel);
  if (targetLevel === 1) return def.cost;
  return grow(def.cost, COST_NUM, COST_DEN, targetLevel - 1);
}

/** Custo da próxima melhoria a partir do nível atual; null se já está no máximo. */
export function nextUpgradeCost(def: EconomyDefinition, currentLevel: number): bigint | null {
  assertLevel(currentLevel, def.maxLevel);
  return currentLevel >= def.maxLevel ? null : upgradeCostTo(def, currentLevel + 1);
}

/** Receita bruta por ciclo: round(base × 1,10^(n−1)). */
export function revenueAt(def: EconomyDefinition, level: number): bigint {
  assertLevel(level, def.maxLevel);
  return grow(def.revenue, REVENUE_NUM, REVENUE_DEN, level - 1);
}

/** Lucro por ciclo = receita bruta − custo operacional, nunca negativo. */
export function profitPerCycle(def: EconomyDefinition, level: number, stars = 0): bigint {
  const profit = revenueAt(def, level) - def.operatingCost;
  return profit > 0n ? withPrestige(profit, stars) : 0n;
}
