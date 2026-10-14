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
  /** Preço do ajudante (gerente) — proposta: ~4× o negócio; água mais barata p/ o tutorial. */
  managerCost: bigint;
  maxLevel: number;
}

const MAX_LEVEL = 100;

/** Praia 4 negócios, cidade 6, porto 6, centro 6 (ordem do catálogo). */
function districtOfIndex(i: number): District {
  if (i < 4) return "praia";
  if (i < 10) return "cidade";
  if (i < 16) return "porto";
  return "centro";
}

export const BUSINESS_CATALOG: readonly BusinessSeed[] = [
  ["agua", "Carrinho de Água", 100n, 10n, 10, 150n],
  ["pipoca", "Carrinho de Pipoca", 500n, 40n, 20, 2_000n],
  ["sorveteria", "Sorveteria", 2_000n, 150n, 30, 8_000n],
  // Na ilha da praia a "Lanchonete" da doc virou o Quiosque de Coco (direção visual v2).
  ["quiosque_coco", "Quiosque de Coco", 8_000n, 600n, 45, 32_000n],
  ["mercadinho", "Mercadinho", 25_000n, 1_800n, 60, 100_000n],
  ["restaurante", "Restaurante", 80_000n, 5_000n, 90, 320_000n],
  ["supermercado", "Supermercado", 250_000n, 14_000n, 120, 1_000_000n],
  ["academia", "Academia", 700_000n, 35_000n, 180, 2_800_000n],
  ["hotel", "Hotel", 2_000_000n, 100_000n, 240, 8_000_000n],
  ["shopping", "Shopping", 8_000_000n, 350_000n, 300, 32_000_000n],
  // Porto da Marina (mapa 3) e Centro Financeiro (mapa 4) — pedido do titular em 2026-10-13.
  // Continuam a progressão da cidade (~1,7× por negócio; ajudante ~4× o negócio). O teto
  // vem da fórmula: custo no nível 100 precisa caber no inteiro seguro (~9×10^15).
  ["peixaria", "Peixaria", 25_000_000n, 1_000_000n, 300, 100_000_000n],
  ["loja_surf", "Loja de Surf", 45_000_000n, 1_700_000n, 320, 180_000_000n],
  ["frutos_mar", "Frutos do Mar", 80_000_000n, 2_900_000n, 340, 320_000_000n],
  ["marina", "Marina", 140_000_000n, 4_900_000n, 360, 560_000_000n],
  ["estaleiro", "Estaleiro", 250_000_000n, 8_500_000n, 380, 1_000_000_000n],
  ["terminal", "Terminal de Cargas", 450_000_000n, 15_000_000n, 400, 1_800_000_000n],
  ["joalheria", "Joalheria", 800_000_000n, 26_000_000n, 420, 3_200_000_000n],
  ["banco", "Banco", 1_400_000_000n, 44_000_000n, 440, 5_600_000_000n],
  ["torre", "Torre de Escritórios", 2_400_000_000n, 74_000_000n, 460, 9_600_000_000n],
  ["convencoes", "Centro de Convenções", 4_000_000_000n, 120_000_000n, 480, 16_000_000_000n],
  ["estadio", "Estádio", 6_000_000_000n, 176_000_000n, 500, 24_000_000_000n],
  ["aeroporto", "Aeroporto", 8_500_000_000n, 245_000_000n, 520, 34_000_000_000n],
].map(([slug, name, cost, revenue, cycleSeconds, managerCost], i) => ({
  slug: slug as string,
  name: name as string,
  sortOrder: i + 1,
  district: districtOfIndex(i),
  cost: cost as bigint,
  revenue: revenue as bigint,
  operatingCost: 0n,
  cycleSeconds: cycleSeconds as number,
  managerCost: managerCost as bigint,
  maxLevel: MAX_LEVEL,
}));
