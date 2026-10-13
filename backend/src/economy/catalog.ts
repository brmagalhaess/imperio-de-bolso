import type { District } from "./districts.js";

// Catálogo inicial (docs/README.md §6). Valores de nível 1; balanceamento futuro
// altera estes números e roda o seed novamente — o banco é a fonte em runtime.
// No MVP, "Lucro/ciclo" da documentação = receita, com custo operacional zero.

export interface BusinessSeed {
  slug: string;
  name: string;
  sortOrder: number;
  district: District;
  cost: bigint;
  revenue: bigint;
  operatingCost: bigint;
  cycleSeconds: number;
  maxLevel: number;
}

const MAX_LEVEL = 100;

export const BUSINESS_CATALOG: readonly BusinessSeed[] = [
  ["agua", "Carrinho de Água", 100n, 10n, 10],
  ["pipoca", "Carrinho de Pipoca", 500n, 40n, 20],
  ["sorveteria", "Sorveteria", 2_000n, 150n, 30],
  // Na ilha da praia a "Lanchonete" da doc virou o Quiosque de Coco (direção visual v2).
  ["quiosque_coco", "Quiosque de Coco", 8_000n, 600n, 45],
  ["mercadinho", "Mercadinho", 25_000n, 1_800n, 60],
  ["restaurante", "Restaurante", 80_000n, 5_000n, 90],
  ["supermercado", "Supermercado", 250_000n, 14_000n, 120],
  ["academia", "Academia", 700_000n, 35_000n, 180],
  ["hotel", "Hotel", 2_000_000n, 100_000n, 240],
  ["shopping", "Shopping", 8_000_000n, 350_000n, 300],
].map(([slug, name, cost, revenue, cycleSeconds], i) => ({
  slug: slug as string,
  name: name as string,
  sortOrder: i + 1,
  district: i < 4 ? "praia" : "cidade",
  cost: cost as bigint,
  revenue: revenue as bigint,
  operatingCost: 0n,
  cycleSeconds: cycleSeconds as number,
  maxLevel: MAX_LEVEL,
}));
