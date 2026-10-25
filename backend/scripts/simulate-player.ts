// Simulação de jogadores (avaliação de dificuldade/retenção). Usa as fórmulas reais da economia
// (src/economy) e reproduz as regras do servidor: ciclo manual no mapa aberto, ajudante produz
// só fora do mapa (até 4h), marcos de velocidade, prêmio diário, missões e baú.
// Uso: npx tsx scripts/simulate-player.ts
import { BUSINESS_CATALOG, type BusinessSeed } from "../src/economy/catalog.js";
import { DAILY_REWARDS, MISSION_CHEST } from "../src/economy/daily.js";
import { DISTRICTS } from "../src/economy/districts.js";
import { nextUpgradeCost, profitPerCycle } from "../src/economy/formulas.js";
import { OFFLINE_CAP_MS } from "../src/economy/offline.js";
import { PRESTIGE_MAPS, starsFor } from "../src/economy/prestige.js";
import { baseSpeedPercent, effectiveCycleMs } from "../src/economy/speed.js";

interface Profile {
  name: string;
  sessionsPerDay: number[]; // minutos de cada sessão no dia
  sessionHours: number[]; // hora do dia de cada sessão
  reactionS: number; // de quanto em quanto tempo olha a tela e coleta
  days: number;
  missionsPerDay: number; // quantas missões costuma concluir
  useGemsForAutoCollect: boolean;
  /** Novato: junta para o próximo prédio e só melhora se for barato perto dele. */
  saveForNext?: boolean;
  /** Teste de balanceamento: preço de compra por negócio. */
  costOverride?: Record<string, number>;
}

interface Biz {
  def: BusinessSeed;
  level: number; // 0 = não tem
  helper: boolean;
  cycleLeftMs: number; // ciclo manual em andamento (0 = pronto p/ coletar)
  afkCarryMs: number; // trabalho acumulado AFK
  afkSince: number | null; // ms desde quando produz AFK
}

const fmt = (n: number) => {
  const s = ["", "K", "M", "B", "T", "aa", "ab"];
  let i = 0;
  while (Math.abs(n) >= 1000 && i < s.length - 1) {
    n /= 1000;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)}${s[i]}`;
};
const mins = (ms: number) => `${(ms / 60000).toFixed(1)} min`;
const dur = (ms: number) =>
  ms < 3600_000
    ? mins(ms)
    : ms < 86_400_000
      ? `${(ms / 3600_000).toFixed(1)} h`
      : `${(ms / 86_400_000).toFixed(1)} d`;

/** Teste de balanceamento: crescimento da receita por nível (padrão do jogo 1,12). */
const REV_GROWTH = Number(process.env.REV_GROWTH ?? 0);
const REV_SCALE: Record<string, number> = JSON.parse(process.env.REV_SCALE ?? "{}");

function simulate(p: Profile) {
  const biz: Biz[] = BUSINESS_CATALOG.map((def) => ({
    def: {
      ...def,
      ...(p.costOverride?.[def.slug] ? { cost: BigInt(p.costOverride[def.slug]!) } : {}),
      ...(REV_SCALE[def.district] !== undefined
        ? {
            revenue: BigInt(
              Math.max(1, Math.round(Number(def.revenue) * REV_SCALE[def.district]!)),
            ),
          }
        : {}),
    },
    level: 0,
    helper: false,
    cycleLeftMs: 0,
    afkCarryMs: 0,
    afkSince: null,
  }));
  let coins = 100; // STARTING_COINS
  let gems = 0;
  let totalEarned = 0;
  let taps = 0;
  let autoCollectUntil = 0;
  let turboUntil = 0;
  let current = "praia";
  let streak = 0;
  const log: string[] = [];
  const timeline: string[] = [];
  const firstSession = { firstBuyMs: -1, purchases: [] as number[], longestGap: 0 };
  const sessionStats: {
    earned: number;
    day: number;
    min: number;
    buys: number;
    longestGapMs: number;
    taps: number;
    nextGoalMs: number;
  }[] = [];
  const mapUnlock: Record<string, number> = { praia: 0 };
  let prestigeAt = -1;

  const speedOf = (b: Biz, t: number) =>
    baseSpeedPercent({ level: b.level, managerUnlocked: b.helper }) + (t < turboUntil ? 100 : 0);
  const cycleMs = (b: Biz, t: number) => effectiveCycleMs(b.def.cycleSeconds, speedOf(b, t));
  const profit = (b: Biz) =>
    REV_GROWTH
      ? Math.round(Number(b.def.revenue) * REV_GROWTH ** (Math.max(b.level, 1) - 1))
      : Number(profitPerCycle(b.def, Math.max(b.level, 1)));
  const incomePerSec = (t: number) =>
    biz.filter((b) => b.level > 0).reduce((s, b) => s + (profit(b) * 1000) / cycleMs(b, t), 0);
  const earn = (v: number) => {
    coins += v;
    totalEarned += v;
  };
  const districtOpen = (d: string) => {
    const i = DISTRICTS.indexOf(d as (typeof DISTRICTS)[number]);
    if (i <= 0) return true;
    return biz.filter((b) => b.def.district === DISTRICTS[i - 1]).every((b) => b.level > 0);
  };

  // AFK: trabalho em ms base (velocidade sem turbo para simplificar, + turbo se ativo inteiro)
  const startAfk = (d: string, t: number) => {
    for (const b of biz)
      if (b.def.district === d && b.helper && b.afkSince === null) b.afkSince = t;
  };
  const payAfk = (d: string, t: number) => {
    let total = 0;
    for (const b of biz) {
      if (b.def.district !== d || !b.helper || b.afkSince === null) continue;
      const elapsed = Math.min(t - b.afkSince, OFFLINE_CAP_MS);
      const work = (elapsed * speedOf(b, t)) / 100 + b.afkCarryMs;
      const base = b.def.cycleSeconds * 1000;
      const cycles = Math.floor(work / base);
      b.afkCarryMs = work - cycles * base;
      total += cycles * profit(b);
      b.afkSince = null;
    }
    earn(total);
    return total;
  };

  // Melhor ação de compra (jogador razoável: maior renda extra por moeda; compra o que dá).
  type Action = { kind: "buy" | "up" | "hire"; b: Biz; cost: number; gain: number };
  const actions = (t: number): Action[] => {
    const out: Action[] = [];
    for (const b of biz) {
      if (b.level === 0) {
        if (!districtOpen(b.def.district)) continue;
        out.push({
          kind: "buy",
          b,
          cost: Number(b.def.cost),
          gain: ((profit(b) * 1000) / cycleMs(b, t)) * 1.5,
        });
      } else {
        const next = nextUpgradeCost(b.def, b.level);
        if (next !== null) {
          const before = (profit(b) * 1000) / cycleMs(b, t);
          b.level++;
          const after = (profit(b) * 1000) / cycleMs(b, t);
          b.level--;
          out.push({ kind: "up", b, cost: Number(next), gain: after - before });
        }
        if (!b.helper) {
          // Ajudante: renda enquanto fora (o jogador valoriza ~metade) + 25% de velocidade.
          out.push({
            kind: "hire",
            b,
            cost: Number(b.def.managerCost),
            gain: ((profit(b) * 1000) / cycleMs(b, t)) * 0.6,
          });
        }
      }
    }
    return out.sort((a, b) => b.gain / b.cost - a.gain / a.cost);
  };
  const apply = (a: Action, t: number) => {
    coins -= a.cost;
    if (a.kind === "buy") {
      a.b.level = 1;
      a.b.cycleLeftMs = cycleMs(a.b, t);
      if (!mapUnlock[a.b.def.district]) {
        mapUnlock[a.b.def.district] = t;
        log.push(`${dur(t)}: abriu o mapa "${a.b.def.district}"`);
      }
      current = a.b.def.district;
    } else if (a.kind === "up") a.b.level++;
    else {
      a.b.helper = true;
      if (a.b.def.district !== current || t < autoCollectUntil) startAfk(a.b.def.district, t);
    }
  };

  const DAY = 86_400_000;
  let lastDay = -1;
  for (let day = 0; day < p.days; day++) {
    p.sessionsPerDay.forEach((len, si) => {
      const start = day * DAY + p.sessionHours[si]! * 3600_000;
      let t = start;
      const end = start + len * 60_000;
      // Abre o jogo: paga AFK de todos os mapas visitados (jogador passa por eles) e prêmio diário.
      for (const d of DISTRICTS) if (mapUnlock[d] !== undefined) payAfk(d, t);
      for (const b of biz)
        if (b.level > 0 && !b.helper && b.def.district !== current && b.cycleLeftMs <= 0) {
          taps++;
          earn(profit(b));
          b.cycleLeftMs = cycleMs(b, t);
        }
      if (day !== lastDay) {
        streak = Math.min(streak + 1, 7);
        const r = DAILY_REWARDS[(streak - 1) % 7]!;
        const ips = incomePerSec(t);
        if (r.coinsMinutes) earn(Math.max(Number(r.minCoins ?? 0), ips * 60 * r.coinsMinutes));
        if (r.gems) gems += r.gems;
        if (r.turboMinutes) turboUntil = Math.max(turboUntil, t) + r.turboMinutes * 60_000;
        lastDay = day;
      }
      if (
        p.useGemsForAutoCollect &&
        gems >= 20 &&
        t >= autoCollectUntil &&
        biz.some((b) => b.helper)
      ) {
        gems -= 20;
        autoCollectUntil = t + 24 * 3600_000;
      }
      // Outros mapas com ajudante passam a produzir AFK enquanto o jogador está no mapa atual.
      for (const d of DISTRICTS) if (d !== current) startAfk(d, t);
      if (t < autoCollectUntil) startAfk(current, t);

      let buys = 0;
      let lastBuy = t;
      let longestGap = 0;
      let sessionTaps = 0;
      const missionsDone = si < p.missionsPerDay;
      while (t < end) {
        const step = p.reactionS * 1000;
        t += step;
        // ciclos manuais do mapa atual
        for (const b of biz) {
          if (b.level === 0 || b.def.district !== current) continue;
          if (b.helper && t < autoCollectUntil) continue; // auto-coleta: AFK no mapa
          b.cycleLeftMs -= step;
          if (b.cycleLeftMs <= 0) {
            // jogador toca a moeda (perde o tempo de reação)
            earn(profit(b));
            taps++;
            sessionTaps++;
            b.cycleLeftMs = cycleMs(b, t);
          }
        }
        if (t < autoCollectUntil) {
          payAfk(current, t);
          startAfk(current, t);
        }
        for (;;) {
          const all = actions(t);
          const goal = p.saveForNext
            ? all.filter((a) => a.kind === "buy").sort((a, b) => a.cost - b.cost)[0]
            : undefined;
          const best =
            goal && goal.cost <= coins
              ? goal
              : all.find(
                  (a) =>
                    a.cost <= coins && (!goal || a.kind === "buy" || a.cost <= goal.cost * 0.15),
                );
          if (!best) break;
          const prev = current;
          apply(best, t);
          if (current !== prev) {
            startAfk(prev, t);
            payAfk(current, t);
          }
          buys++;
          if (day === 0 && si === 0)
            timeline.push(
              `${mins(t - start)}: ${best.kind === "buy" ? "comprou" : best.kind === "up" ? "melhorou" : "contratou ajudante em"} ${best.b.def.name}${best.kind === "up" ? ` (nv ${best.b.level})` : ""}`,
            );
          longestGap = Math.max(longestGap, t - lastBuy);
          lastBuy = t;
          if (day === 0 && si === 0) {
            if (firstSession.firstBuyMs < 0) firstSession.firstBuyMs = t - start;
            firstSession.purchases.push(t - start);
          }
        }
        if (
          prestigeAt < 0 &&
          biz
            .filter((b) => DISTRICTS.indexOf(b.def.district as never) < PRESTIGE_MAPS)
            .every((b) => b.level > 0 && b.helper)
        )
          prestigeAt = t;
      }
      longestGap = Math.max(longestGap, t - lastBuy);
      if (missionsDone) {
        const ips = incomePerSec(t);
        earn(Math.max(50, ips * 900));
        gems += 1;
        if (si === p.missionsPerDay - 1 && p.missionsPerDay >= 3) {
          gems += MISSION_CHEST.gems;
          turboUntil = Math.max(turboUntil, t) + MISSION_CHEST.turboMinutes * 60_000;
        }
      }
      const cheapest = actions(t)
        .filter((a) => a.kind !== "up")
        .sort((a, b) => a.cost - b.cost)[0];
      const ips = incomePerSec(t);
      const nextGoalMs = cheapest
        ? Math.max(0, (cheapest.cost - coins) / Math.max(ips, 1e-9)) * 1000
        : 0;
      if (day === 0 && si === 0) firstSession.longestGap = longestGap;
      sessionStats.push({
        earned: totalEarned,
        day: day + 1,
        min: len,
        buys,
        longestGapMs: longestGap,
        taps: sessionTaps,
        nextGoalMs,
      });
      // fecha o jogo: tudo com ajudante vira AFK
      for (const d of DISTRICTS) startAfk(d, t);
    });
  }
  const owned = biz.filter((b) => b.level > 0);
  return {
    profile: p.name,
    timeline,
    firstSession,
    sessionStats,
    log,
    mapUnlock,
    prestigeAt,
    end: {
      coins,
      gems,
      totalEarned,
      income: incomePerSec(p.days * DAY),
      owned: owned.length,
      helpers: owned.filter((b) => b.helper).length,
      avgLevel: owned.reduce((s, b) => s + b.level, 0) / Math.max(owned.length, 1),
      taps,
    },
  };
}

const profiles: Profile[] = [
  {
    name: "Novato seguindo o instinto (30 min, junta para o próximo prédio)",
    sessionsPerDay: [30],
    sessionHours: [20],
    reactionS: 3,
    days: 1,
    missionsPerDay: 0,
    useGemsForAutoCollect: false,
    saveForNext: true,
  },
  {
    name: "Curioso (1 sessão de 15 min e some)",
    sessionsPerDay: [15],
    sessionHours: [20],
    reactionS: 3,
    days: 1,
    missionsPerDay: 0,
    useGemsForAutoCollect: false,
  },
  {
    name: "Casual (3×8 min/dia)",
    sessionsPerDay: [8, 8, 8],
    sessionHours: [8, 13, 21],
    reactionS: 4,
    days: 30,
    missionsPerDay: 2,
    useGemsForAutoCollect: false,
  },
  {
    name: "Engajado (5×15 min/dia)",
    sessionsPerDay: [15, 15, 15, 15, 15],
    sessionHours: [7, 11, 15, 19, 22],
    reactionS: 2,
    days: 30,
    missionsPerDay: 3,
    useGemsForAutoCollect: true,
  },
];

for (const p of profiles) {
  const r = simulate(p);
  console.log(`\n=== ${r.profile} ===`);
  const fs = r.firstSession;
  console.log(
    `1ª sessão: 1ª compra aos ${(fs.firstBuyMs / 1000).toFixed(0)} s; ${fs.purchases.length} compras; maior espera sem comprar ${mins(fs.longestGap)}`,
  );
  const buckets = [1, 5, 10, 15].map((m) => fs.purchases.filter((x) => x <= m * 60_000).length);
  console.log(`  compras acumuladas aos 1/5/10/15 min: ${buckets.join(" / ")}`);
  if (p.saveForNext)
    console.log(
      r.timeline
        .filter((l) => !l.includes("melhorou") || /nv (5|10|15|20|25)\)/.test(l))
        .join("\n"),
    );
  console.log(r.log.join("\n"));
  const days = [1, 2, 3, 7, 14, 30];
  for (const d of days) {
    const s = r.sessionStats.filter((x) => x.day === d);
    if (!s.length) continue;
    const buys = s.reduce((a, x) => a + x.buys, 0);
    const gap = Math.max(...s.map((x) => x.longestGapMs));
    const taps = s.reduce((a, x) => a + x.taps, 0);
    const playMin = s.reduce((a, x) => a + x.min, 0);
    const goal = s[s.length - 1]!.nextGoalMs;
    const earned = s[s.length - 1]!.earned;
    const stars = starsFor(BigInt(Math.floor(earned)));
    console.log(
      `Dia ${String(d).padStart(2)}: ${buys} compras em ${playMin} min; maior espera ${mins(gap)}; ${(taps / playMin).toFixed(0)} toques/min; próximo negócio/ajudante em ${dur(goal)}; faturou ${fmt(earned)} → vender daria ${fmt(stars)} estrelas (+${fmt(stars * 2)}% de lucro)`,
    );
  }
  console.log(`Vender império liberado em: ${r.prestigeAt < 0 ? "não chegou" : dur(r.prestigeAt)}`);
  const e = r.end;
  console.log(
    `Fim: ${e.owned}/${BUSINESS_CATALOG.length} negócios, ${e.helpers} ajudantes, nível médio ${e.avgLevel.toFixed(0)}, renda ${fmt(e.income)}/s, faturou ${fmt(e.totalEarned)}, ${e.gems} 💎`,
  );
}
