import { describe, expect, it } from "vitest";
import { BUSINESS_CATALOG } from "../src/economy/catalog.js";
import {
  nextUpgradeCost,
  profitPerCycle,
  revenueAt,
  upgradeCostTo,
} from "../src/economy/formulas.js";

const agua = BUSINESS_CATALOG[0]!;

describe("fórmulas de economia", () => {
  it("catálogo tem os 10 negócios da documentação", () => {
    expect(BUSINESS_CATALOG.map((b) => b.slug)).toEqual([
      "agua",
      "pipoca",
      "sorveteria",
      "quiosque_coco",
      "mercadinho",
      "restaurante",
      "supermercado",
      "academia",
      "hotel",
      "shopping",
    ]);
    expect(agua).toMatchObject({ cost: 100n, revenue: 10n, cycleSeconds: 10 });
  });

  it("custo de upgrade = round(base × 1,15^(n−1))", () => {
    expect(upgradeCostTo(agua, 1)).toBe(100n);
    expect(upgradeCostTo(agua, 2)).toBe(115n);
    expect(upgradeCostTo(agua, 10)).toBe(352n); // 100 × 1,15^9 = 351,79
    expect(nextUpgradeCost(agua, 1)).toBe(115n);
  });

  it("receita = round(base × 1,12^(n−1))", () => {
    expect(revenueAt(agua, 1)).toBe(10n);
    expect(revenueAt(agua, 2)).toBe(11n);
    expect(revenueAt(agua, 10)).toBe(28n); // 10 × 1,12^9 = 27,73
  });

  it("custos e receitas nunca diminuem com o nível e cabem no limite seguro", () => {
    for (const def of BUSINESS_CATALOG) {
      let prevCost = 0n;
      let prevRevenue = 0n;
      for (let level = 1; level <= def.maxLevel; level++) {
        const cost = upgradeCostTo(def, level);
        const revenue = revenueAt(def, level);
        expect(cost).toBeGreaterThanOrEqual(prevCost);
        expect(revenue).toBeGreaterThanOrEqual(prevRevenue);
        expect(cost).toBeLessThanOrEqual(BigInt(Number.MAX_SAFE_INTEGER));
        prevCost = cost;
        prevRevenue = revenue;
      }
      expect(nextUpgradeCost(def, def.maxLevel)).toBeNull();
    }
  });

  it("rejeita níveis inválidos", () => {
    expect(() => upgradeCostTo(agua, 0)).toThrow(RangeError);
    expect(() => upgradeCostTo(agua, agua.maxLevel + 1)).toThrow(RangeError);
    expect(() => revenueAt(agua, 1.5)).toThrow(RangeError);
  });

  it("lucro nunca é negativo, mesmo com custo operacional maior que a receita", () => {
    expect(profitPerCycle({ ...agua, operatingCost: 4n }, 1)).toBe(6n);
    expect(profitPerCycle({ ...agua, operatingCost: 1_000n }, 1)).toBe(0n);
  });
});
