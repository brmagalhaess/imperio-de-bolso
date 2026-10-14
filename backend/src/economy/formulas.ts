// Fórmulas de economia (docs/README.md §6). Configuráveis via catálogo;
// os multiplicadores ficam aqui até existir game_config_versions.

import { withPrestige } from "./prestige.js";

export const UPGRADE_COST_GROWTH = 1.15;
export const REVENUE_GROWTH = 1.12;

export interface EconomyDefinition {
  cost: bigint;
  revenue: bigint;
  operatingCost: bigint;
  maxLevel: number;
}

function roundToBigInt(value: number): bigint {
  if (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`valor econômico fora da faixa segura: ${value}`);
  }
  return BigInt(Math.round(value));
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
  return roundToBigInt(Number(def.cost) * UPGRADE_COST_GROWTH ** (targetLevel - 1));
}

/** Custo da próxima melhoria a partir do nível atual; null se já está no máximo. */
export function nextUpgradeCost(def: EconomyDefinition, currentLevel: number): bigint | null {
  assertLevel(currentLevel, def.maxLevel);
  return currentLevel >= def.maxLevel ? null : upgradeCostTo(def, currentLevel + 1);
}

/** Receita bruta por ciclo: round(base × 1,12^(n−1)). */
export function revenueAt(def: EconomyDefinition, level: number): bigint {
  assertLevel(level, def.maxLevel);
  return roundToBigInt(Number(def.revenue) * REVENUE_GROWTH ** (level - 1));
}

/** Lucro por ciclo = receita bruta − custo operacional, nunca negativo. */
export function profitPerCycle(def: EconomyDefinition, level: number, stars = 0): bigint {
  const profit = revenueAt(def, level) - def.operatingCost;
  return profit > 0n ? withPrestige(profit, stars) : 0n;
}
