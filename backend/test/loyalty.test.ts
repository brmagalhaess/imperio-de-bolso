import { afterEach, describe, expect, it } from "vitest";
import { leagueMoves, podiumPrizes } from "../src/services/leaderboard.js";
import {
  coinsOf,
  createTestContext,
  get,
  key,
  newGuest,
  post,
  setCoins,
  type Guest,
  type TestContext,
} from "./helpers.js";

// Retenção (ADR 0014): calendário de 7 dias, baú das missões, evento de fim de semana e ligas.
// Relógio dos testes começa numa quinta, 2026-01-01 09:00 (Brasília).

let ctx: TestContext;

afterEach(async () => {
  await ctx?.close();
});

const HOUR = 3600;
const gemsOf = async (playerId: string) =>
  (await ctx.db.playerWallet.findUniqueOrThrow({ where: { playerId } })).gems;

describe("calendário de 7 dias", () => {
  it("um prêmio por dia; dias seguidos avançam e faltar um dia volta ao 1", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    const first = (await get(ctx.app, g, "/daily-reward")).json();
    expect(first).toMatchObject({ day: 1, claimedToday: false });
    expect(first.rewards).toHaveLength(7);

    const k = key();
    const claim = await post(ctx.app, g, "/daily-reward/claim", {}, k);
    expect(claim.statusCode).toBe(200);
    expect(claim.json().claimed).toBe(1);
    const coins = await coinsOf(ctx.db, g.playerId);
    expect((await post(ctx.app, g, "/daily-reward/claim", {}, k)).json().claimed).toBe(1);
    expect(await coinsOf(ctx.db, g.playerId)).toBe(coins); // repetição não paga de novo
    const again = await post(ctx.app, g, "/daily-reward/claim", {});
    expect(again.json().error.code).toBe("DAILY_REWARD_CLAIMED");

    ctx.clock.advance(24 * HOUR); // dia seguinte: dia 2 = 5 diamantes
    expect((await get(ctx.app, g, "/daily-reward")).json()).toMatchObject({ day: 2 });
    await post(ctx.app, g, "/daily-reward/claim", {});
    expect(await gemsOf(g.playerId)).toBe(5n);

    ctx.clock.advance(48 * HOUR); // pulou um dia
    expect((await get(ctx.app, g, "/daily-reward")).json()).toMatchObject({ day: 1 });
  });

  it("dia 4 dá Turbo 2× por 1 hora", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    for (let d = 0; d < 4; d++) {
      await post(ctx.app, g, "/daily-reward/claim", {});
      if (d < 3) ctx.clock.advance(24 * HOUR);
    }
    const state = (await get(ctx.app, g, "/player/state")).json();
    expect(state.player.turboUntil).toBe(
      new Date(ctx.clock.now.getTime() + HOUR * 1000).toISOString(),
    );
  });
});

describe("baú das missões", () => {
  it("abre só depois de resgatar as 3 missões do dia, uma vez", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    const list = (await get(ctx.app, g, "/missions")).json();
    expect(list.chest).toMatchObject({ available: false, claimed: false, gems: 5, target: 3 });
    expect((await post(ctx.app, g, "/missions/chest", {})).json().error.code).toBe(
      "MISSION_CHEST_LOCKED",
    );
    await ctx.db.playerMission.updateMany({
      where: { playerId: g.playerId },
      data: { claimedAt: ctx.clock.now },
    });
    const open = await post(ctx.app, g, "/missions/chest", {});
    expect(open.statusCode).toBe(200);
    expect(open.json().chest).toMatchObject({ claimed: true });
    expect(await gemsOf(g.playerId)).toBe(5n);
    expect(open.json().state.player.turboUntil).not.toBeNull();
    expect((await post(ctx.app, g, "/missions/chest", {})).json().error.code).toBe(
      "MISSION_CHEST_CLAIMED",
    );
  });
});

describe("evento de fim de semana", () => {
  async function waterOwner(): Promise<Guest> {
    const g = await newGuest(ctx.app);
    await setCoins(ctx.db, g.playerId, 1_000n);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    return g;
  }

  it("só na sexta–domingo; mapa do evento rende 2× e a meta paga diamantes uma vez", async () => {
    ctx = await createTestContext();
    const g = await waterOwner();
    expect((await get(ctx.app, g, "/event")).json()).toMatchObject({ active: false });

    ctx.clock.advance(15 * HOUR); // sexta 00:00
    const ev = (await get(ctx.app, g, "/event")).json();
    expect(ev).toMatchObject({
      active: true,
      district: "praia",
      profitMultiplier: 2,
      target: "7200", // 2 h da renda (1 moeda/s)
    });
    const agua = (await get(ctx.app, g, "/player/state"))
      .json()
      .businesses.find((b: { slug: string }) => b.slug === "agua");
    expect(agua.profitPerCycle).toBe("20");

    expect((await post(ctx.app, g, "/event/claim", {})).json().error.code).toBe(
      "EVENT_GOAL_NOT_REACHED",
    );
    ctx.clock.advance(10);
    const collect = await post(ctx.app, g, "/production/collect", { businessSlug: "agua" });
    expect(collect.json().total).toBe("20"); // coleta paga em dobro
    await ctx.db.walletLedger.create({
      data: {
        playerId: g.playerId,
        currency: "COINS",
        delta: 7_180n,
        balanceAfter: 0n,
        reason: "production_auto",
        createdAt: ctx.clock.now,
      },
    });
    const done = (await get(ctx.app, g, "/event")).json();
    expect(done).toMatchObject({ completed: true, progress: "7200" });
    expect((await post(ctx.app, g, "/event/claim", {})).statusCode).toBe(200);
    expect(await gemsOf(g.playerId)).toBe(20n);
    expect((await post(ctx.app, g, "/event/claim", {})).json().error.code).toBe(
      "EVENT_ALREADY_CLAIMED",
    );

    ctx.clock.advance(3 * 24 * HOUR); // segunda: acabou
    expect((await get(ctx.app, g, "/event")).json()).toMatchObject({ active: false });
  });
});

describe("ligas semanais e ranking de estrelas", () => {
  it("regra de subida/descida", () => {
    expect(leagueMoves(1)).toEqual({ promote: 1, demote: 0 });
    expect(leagueMoves(10)).toEqual({ promote: 2, demote: 2 });
  });

  it("todo mundo começa no Bronze; quem lidera a semana sobe para a Prata", async () => {
    ctx = await createTestContext();
    const players: Guest[] = [];
    for (let i = 0; i < 5; i++) players.push(await newGuest(ctx.app));
    for (const [i, g] of players.entries()) {
      const lb = (await get(ctx.app, g, "/leaderboard")).json();
      expect(lb.league).toMatchObject({ tier: 0, name: "Bronze" });
      await ctx.db.walletLedger.create({
        data: {
          playerId: g.playerId,
          currency: "COINS",
          delta: BigInt((i + 1) * 100),
          balanceAfter: 0n,
          reason: "production_collect",
          createdAt: ctx.clock.now,
        },
      });
    }
    const lb = (await get(ctx.app, g0(players), "/leaderboard")).json();
    expect(lb.league.size).toBe(5);
    expect(lb.league.entries[0].score).toBe("500");

    ctx.clock.advance(7 * 24 * HOUR); // semana seguinte
    const top = (await get(ctx.app, players[4]!, "/leaderboard")).json();
    expect(top.league).toMatchObject({ tier: 1, name: "Prata" });
    const bottom = (await get(ctx.app, players[0]!, "/leaderboard")).json();
    expect(bottom.league).toMatchObject({ tier: 0 });

    await ctx.db.player.update({ where: { id: players[2]!.playerId }, data: { prestigeStars: 7 } });
    const stars = (await get(ctx.app, players[2]!, "/leaderboard/stars")).json();
    expect(stars.entries[0]).toMatchObject({ rank: 1, score: "7", isMe: true });
  });
});

const g0 = (p: Guest[]) => p[0]!;

describe("pódio semanal e prestígio no ranking", () => {
  const earn = (playerId: string, delta: bigint) =>
    ctx.db.walletLedger.create({
      data: {
        playerId,
        currency: "COINS",
        delta,
        balanceAfter: 0n,
        reason: "production_collect",
        createdAt: ctx.clock.now,
      },
    });

  /** Império completo (requisito da venda): todos os negócios com ajudante. */
  const completeEmpire = async (playerId: string) => {
    for (const def of await ctx.db.businessDefinition.findMany()) {
      await ctx.db.playerBusiness.create({
        data: {
          playerId,
          businessId: def.id,
          level: 1,
          managerUnlocked: true,
          cycleStartedAt: ctx.clock.now,
          lastSettlementAt: ctx.clock.now,
        },
      });
    }
  };

  it("vender o império zera a pontuação da semana e da liga; o que fatura depois conta", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    const rival = await newGuest(ctx.app);
    await get(ctx.app, g, "/leaderboard"); // entra na liga
    await get(ctx.app, rival, "/leaderboard");
    await earn(g.playerId, 50_000_000n);
    await earn(rival.playerId, 1_000n);
    await completeEmpire(g.playerId);
    ctx.clock.advance(60);
    expect((await post(ctx.app, g, "/prestige", {})).statusCode).toBe(200);

    let lb = (await get(ctx.app, g, "/leaderboard")).json();
    expect(lb.entries.map((e: { playerId: string }) => e.playerId)).toEqual([rival.playerId]);
    expect(lb.me).toBeNull();
    expect(lb.league.me).toMatchObject({ rank: 2, score: "0" });

    ctx.clock.advance(60);
    await earn(g.playerId, 300n);
    lb = (await get(ctx.app, g, "/leaderboard")).json();
    expect(lb.me).toMatchObject({ rank: 2, score: "300" });
    expect(lb.league.me).toMatchObject({ rank: 2, score: "300" });
  });

  it("vender o império na semana nova não tira o pódio da semana anterior", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await get(ctx.app, g, "/leaderboard");
    await earn(g.playerId, 50_000_000n);
    ctx.clock.advance(7 * 24 * HOUR);
    await completeEmpire(g.playerId);
    expect((await post(ctx.app, g, "/prestige", {})).statusCode).toBe(200);
    const pending = (await get(ctx.app, g, "/rewards/weekly")).json().pending;
    expect(pending.map((r: { kind: string; rank: number }) => `${r.kind}:${r.rank}`)).toEqual([
      "liga:1",
      "semana:1",
    ]);
  });

  it("conta da equipe fica fora do ranking, da liga, das estrelas e do pódio", async () => {
    ctx = await createTestContext();
    const staff = await newGuest(ctx.app);
    const player = await newGuest(ctx.app);
    await ctx.db.player.update({
      where: { id: staff.playerId },
      data: { staff: true, prestigeStars: 99 },
    });
    await ctx.db.player.update({ where: { id: player.playerId }, data: { prestigeStars: 1 } });
    await get(ctx.app, staff, "/leaderboard");
    await get(ctx.app, player, "/leaderboard");
    await earn(staff.playerId, 50_000_000n);
    await earn(player.playerId, 1_000n);

    const mine = (await get(ctx.app, staff, "/leaderboard")).json();
    expect(mine.staff).toBe(true);
    expect(mine.me).toBeNull();
    expect(mine.league.me).toBeNull();
    const theirs = (await get(ctx.app, player, "/leaderboard")).json();
    expect(theirs.staff).toBe(false);
    expect(theirs.entries).toHaveLength(1);
    expect(theirs.me).toMatchObject({ rank: 1, score: "1000" });
    expect(theirs.league).toMatchObject({ size: 1, me: { rank: 1 } });
    const stars = (await get(ctx.app, player, "/leaderboard/stars")).json();
    expect(stars.entries.map((e: { score: string }) => e.score)).toEqual(["1"]);

    ctx.clock.advance(7 * 24 * HOUR);
    expect((await get(ctx.app, staff, "/rewards/weekly")).json().pending).toEqual([]);
    const won = (await get(ctx.app, player, "/rewards/weekly")).json().pending;
    expect(won.map((r: { kind: string; rank: number }) => `${r.kind}:${r.rank}`)).toEqual([
      "liga:1",
      "semana:1",
    ]);
  });

  it("1º, 2º e 3º lugar ganham diamantes na semana seguinte; resgate uma vez", async () => {
    ctx = await createTestContext();
    const players: Guest[] = [];
    for (let i = 0; i < 4; i++) {
      const p = await newGuest(ctx.app);
      players.push(p);
      await get(ctx.app, p, "/leaderboard");
      await earn(p.playerId, BigInt((i + 1) * 1_000));
    }
    const lb = (await get(ctx.app, players[0]!, "/leaderboard")).json();
    const week = podiumPrizes(0, ctx.clock.now);
    expect(lb.prizes).toEqual(week);
    // 2025-12-29 cai na rotação "diamantes em dobro": 1º 600 na semana, 1º 200 na liga Bronze.
    expect(week.bonus).toBe("double_gems");
    expect(week.semana[0]).toEqual({ gems: 600, bonusKind: null, bonusHours: 0 });
    expect((await get(ctx.app, players[3]!, "/rewards/weekly")).json().pending).toEqual([]);

    ctx.clock.advance(7 * 24 * HOUR);
    const first = (await get(ctx.app, players[3]!, "/rewards/weekly")).json();
    expect(first.pending).toEqual([
      {
        week: "2025-12-29",
        kind: "liga",
        rank: 1,
        league: "Bronze",
        gems: 200,
        bonusKind: null,
        bonusHours: 0,
      },
      {
        week: "2025-12-29",
        kind: "semana",
        rank: 1,
        gems: 600,
        league: null,
        bonusKind: null,
        bonusHours: 0,
      },
    ]);
    const third = (await get(ctx.app, players[1]!, "/rewards/weekly")).json();
    expect(third.pending.map((r: { rank: number }) => r.rank)).toEqual([3, 3]);
    expect((await get(ctx.app, players[0]!, "/rewards/weekly")).json().pending).toEqual([]); // 4º

    const claim = await post(ctx.app, players[3]!, "/rewards/weekly/claim", {
      week: "2025-12-29",
      kind: "semana",
    });
    expect(claim.statusCode).toBe(200);
    expect(await gemsOf(players[3]!.playerId)).toBe(600n);
    const again = await post(ctx.app, players[3]!, "/rewards/weekly/claim", {
      week: "2025-12-29",
      kind: "semana",
    });
    expect(again.json().error.code).toBe("WEEKLY_REWARD_CLAIMED");
    expect((await get(ctx.app, players[3]!, "/rewards/weekly")).json().pending).toHaveLength(1);
  });

  it("o bônus muda a cada semana e é entregue no resgate (ex.: Turbo de 6 h para o 1º)", async () => {
    const turboWeek = [0, 1, 2, 3]
      .map((w) => new Date(Date.UTC(2026, 0, 5 + 7 * w, 15)))
      .find((d) => podiumPrizes(0, d).bonus === "turbo")!;
    expect(podiumPrizes(4, turboWeek).liga[0]).toEqual({
      gems: 300,
      bonusKind: "turbo",
      bonusHours: 6,
    });
    const kinds = [0, 1, 2, 3].map(
      (w) => podiumPrizes(0, new Date(Date.UTC(2026, 0, 5 + 7 * w, 15))).bonus,
    );
    expect(new Set(kinds).size).toBe(4);

    ctx = await createTestContext();
    ctx.clock.now = turboWeek;
    const a = await newGuest(ctx.app);
    await get(ctx.app, a, "/leaderboard");
    await earn(a.playerId, 5_000n);
    ctx.clock.advance(7 * 24 * HOUR);
    await get(ctx.app, a, "/rewards/weekly");
    const claim = await post(ctx.app, a, "/rewards/weekly/claim", {
      week: "2026-01-05",
      kind: "semana",
    });
    expect(claim.json().claimed).toMatchObject({ gems: 300, bonusKind: "turbo", bonusHours: 6 });
    expect(new Date(claim.json().state.player.turboUntil).getTime()).toBe(
      ctx.clock.now.getTime() + 6 * 3_600_000,
    );
  });

  it("ligas por vendas do império: quem vendeu não disputa com quem nunca vendeu", async () => {
    ctx = await createTestContext();
    const novato = await newGuest(ctx.app);
    const veterano = await newGuest(ctx.app);
    await ctx.db.player.update({ where: { id: veterano.playerId }, data: { prestigeCount: 2 } });
    const n = (await get(ctx.app, novato, "/leaderboard")).json().league;
    const v = (await get(ctx.app, veterano, "/leaderboard")).json().league;
    expect(n).toMatchObject({ bracket: 0, size: 1 });
    expect(v).toMatchObject({ bracket: 2, size: 1, name: "Bronze" });

    // Vender no meio da semana não muda o grupo até a semana acabar.
    await ctx.db.player.update({ where: { id: novato.playerId }, data: { prestigeCount: 1 } });
    expect((await get(ctx.app, novato, "/leaderboard")).json().league.bracket).toBe(0);
    ctx.clock.advance(7 * 24 * HOUR);
    expect((await get(ctx.app, novato, "/leaderboard")).json().league).toMatchObject({
      bracket: 1,
      tier: 0,
    });
  });
});
