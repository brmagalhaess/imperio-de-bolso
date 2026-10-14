import { afterEach, describe, expect, it } from "vitest";
import { leagueMoves } from "../src/services/leaderboard.js";
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

  it("vender o império não tira o jogador do ranking da semana nem da liga", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await get(ctx.app, g, "/leaderboard"); // entra na liga
    await earn(g.playerId, 50_000_000n);
    for (const slug of [
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
    ]) {
      await ctx.db.playerBusiness.create({
        data: {
          playerId: g.playerId,
          businessId: (await ctx.db.businessDefinition.findUniqueOrThrow({ where: { slug } })).id,
          level: 1,
          cycleStartedAt: ctx.clock.now,
          lastSettlementAt: ctx.clock.now,
        },
      });
    }
    expect((await post(ctx.app, g, "/prestige", {})).statusCode).toBe(200);
    const lb = (await get(ctx.app, g, "/leaderboard")).json();
    expect(lb.me).toMatchObject({ rank: 1, score: "50000000" });
    expect(lb.league.me).toMatchObject({ rank: 1, score: "50000000" });
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
    expect(lb.prizes).toEqual({ semana: [100, 60, 30], liga: [30, 20, 10] });
    expect((await get(ctx.app, players[3]!, "/rewards/weekly")).json().pending).toEqual([]);

    ctx.clock.advance(7 * 24 * HOUR);
    const first = (await get(ctx.app, players[3]!, "/rewards/weekly")).json();
    expect(first.pending).toEqual([
      { week: "2025-12-29", kind: "liga", rank: 1, league: "Bronze", gems: 30 },
      { week: "2025-12-29", kind: "semana", rank: 1, gems: 100, league: null },
    ]);
    const third = (await get(ctx.app, players[1]!, "/rewards/weekly")).json();
    expect(third.pending.map((r: { rank: number }) => r.rank)).toEqual([3, 3]);
    expect((await get(ctx.app, players[0]!, "/rewards/weekly")).json().pending).toEqual([]); // 4º

    const claim = await post(ctx.app, players[3]!, "/rewards/weekly/claim", {
      week: "2025-12-29",
      kind: "semana",
    });
    expect(claim.statusCode).toBe(200);
    expect(await gemsOf(players[3]!.playerId)).toBe(100n);
    const again = await post(ctx.app, players[3]!, "/rewards/weekly/claim", {
      week: "2025-12-29",
      kind: "semana",
    });
    expect(again.json().error.code).toBe("WEEKLY_REWARD_CLAIMED");
    expect((await get(ctx.app, players[3]!, "/rewards/weekly")).json().pending).toHaveLength(1);
  });
});
