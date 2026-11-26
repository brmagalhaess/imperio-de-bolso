// Estimativa de ritmo da ADR 0035: tempo para levar cada mapa ao nível máximo (condição para
// abrir o seguinte), com as fórmulas reais. Jogador idealizado: produz `UPTIME` do tempo, compra
// sempre a melhoria mais barata do mapa atual, contrata ajudantes e evolui os ajudantes quando o
// preço é menor que o da melhoria mais barata.  Uso: npx tsx scripts/simulate-maps.ts [uptime]
import { BUSINESS_CATALOG } from "../src/economy/catalog.js";
import { DISTRICTS } from "../src/economy/districts.js";
import { nextUpgradeCost, profitPerCycle } from "../src/economy/formulas.js";
import { helperUpgradeCost, withHelper } from "../src/economy/helpers.js";
import { baseSpeedPercent, effectiveCycleMs } from "../src/economy/speed.js";

const UPTIME = Number(process.argv[2] ?? 0.5);
interface B {
  i: number;
  def: (typeof BUSINESS_CATALOG)[number];
  level: number;
  helper: number;
}
const all: B[] = BUSINESS_CATALOG.map((def, i) => ({ i, def, level: 0, helper: 0 }));
const perSec = (b: B) => {
  if (b.level === 0) return 0;
  const subject = { businessId: b.i, managerLevel: b.helper };
  const speed = baseSpeedPercent({
    level: b.level,
    managerUnlocked: b.helper > 0,
    managerLevel: b.helper,
    businessId: b.i,
  });
  const profit = Number(withHelper(profitPerCycle(b.def, b.level), subject));
  return (profit * 1000) / effectiveCycleMs(b.def.cycleSeconds, speed);
};
let t = 0;
let coins = 100;
for (const d of DISTRICTS) {
  const mine = all.filter((b) => b.def.district === d);
  const start = t;
  for (;;) {
    const options: { cost: number; apply: () => void }[] = [];
    for (const b of mine) {
      if (b.level === 0) options.push({ cost: Number(b.def.cost), apply: () => (b.level = 1) });
      else {
        const up = nextUpgradeCost(b.def, b.level);
        if (up !== null) options.push({ cost: Number(up), apply: () => (b.level += 1) });
        if (b.helper === 0)
          options.push({ cost: Number(b.def.managerCost), apply: () => (b.helper = 1) });
        else {
          const h = helperUpgradeCost(b.def.managerCost, b.helper + 1);
          if (h !== null) options.push({ cost: Number(h), apply: () => (b.helper += 1) });
        }
      }
    }
    const levelsLeft = mine.some((b) => b.level < b.def.maxLevel);
    if (!levelsLeft) break;
    const pick = options.reduce((a, b) => (b.cost < a.cost ? b : a));
    const income = all.reduce((s, b) => s + perSec(b), 0) * UPTIME;
    if (coins < pick.cost) {
      t += (pick.cost - coins) / Math.max(income, 0.5);
      coins = pick.cost;
    }
    coins -= pick.cost;
    pick.apply();
  }
  const h = (t - start) / 3600;
  console.log(
    `${d.padEnd(11)} ${h < 48 ? h.toFixed(1) + " h" : (h / 24).toFixed(1) + " d"}`.padEnd(24),
    `acumulado ${(t / 86400).toFixed(1)} d`,
  );
}
