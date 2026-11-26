import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gameDay, weekBounds } from "../src/lib/time.js";
import { niceRound, pickDailyMissions } from "../src/economy/missions.js";
import {
  ADMIN_TOKEN,
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

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.close();
});

const missions = async (g: Guest) => (await get(ctx.app, g, "/missions")).json();
const gemsOf = async (playerId: string) =>
  (await ctx.db.playerWallet.findUniqueOrThrow({ where: { playerId } })).gems;

describe("calendário do jogo (Brasília, UTC−3)", () => {
  it("dia vira à meia-noite de Brasília e a semana começa na segunda", () => {
    expect(gameDay(new Date("2026-01-01T02:59:00Z"))).toBe("2025-12-31");
    expect(gameDay(new Date("2026-01-01T03:00:00Z"))).toBe("2026-01-01");
    // quinta 2026-01-01 → semana de segunda 2025-12-29 03:00Z até 2026-01-05 03:00Z
    const w = weekBounds(new Date("2026-01-01T12:00:00Z"));
    expect(w.start.toISOString()).toBe("2025-12-29T03:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-01-05T03:00:00.000Z");
  });

  it("números bonitos para alvos e prêmios", () => {
    expect(niceRound(1234)).toBe(1200n);
    expect(niceRound(87)).toBe(87n);
    expect(niceRound(5)).toBe(5n);
  });
});

describe("missões diárias", () => {
  it("3 missões por dia, sempre com 'colete N vezes', estáveis no mesmo dia", async () => {
    const g = await newGuest(ctx.app);
    const first = await missions(g);
    expect(first.missions).toHaveLength(3);
    expect(first.missions.map((m: { template: string }) => m.template)).toContain("collect_times");
    expect(first.missions.every((m: { rewardGems: number }) => m.rewardGems === 1)).toBe(true);
    // V1.2: modelo com {n} para o cliente traduzir; o título pronto continua em pt-BR.
    for (const m of first.missions as { title: string; titleTemplate: string; target: string }[]) {
      expect(m.titleTemplate).toContain("{n}");
      expect(m.title).toBe(
        m.titleTemplate.replace("{n}", Number(m.target).toLocaleString("pt-BR")),
      );
    }
    const again = await missions(g);
    expect(again.missions.map((m: { id: string }) => m.id)).toEqual(
      first.missions.map((m: { id: string }) => m.id),
    );
    expect(first.resetsAt).toBe("2026-01-02T03:00:00.000Z");
  });

  it("sorteio é determinístico por jogador e dia", () => {
    const ctxM = {
      incomePerSecond: 1,
      ownedCount: 1,
      canBuy: true,
      canHire: true,
      hasHelper: true,
      cityUnlocked: true,
      cheapestBuy: 100,
      cheapestHire: 50,
      coins: 1_000,
    };
    const a = pickDailyMissions("p1", "2026-01-01", ctxM).map((t) => t.id);
    expect(pickDailyMissions("p1", "2026-01-01", ctxM).map((t) => t.id)).toEqual(a);
    expect(a[0]).toBe("collect_times");
    expect(new Set(a).size).toBe(3);
  });

  it("progresso vem dos comandos do servidor e o prêmio sai uma única vez", async () => {
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    for (let i = 0; i < 10; i++) {
      ctx.clock.advance(10);
      expect((await post(ctx.app, g, "/production/collect", {})).statusCode).toBe(200);
    }
    const m = (await missions(g)).missions.find(
      (x: { template: string }) => x.template === "collect_times",
    );
    expect(m).toMatchObject({ progress: "10", target: "10", completed: true, claimed: false });

    const coinsBefore = await coinsOf(ctx.db, g.playerId);
    const k = key();
    const claim = await post(ctx.app, g, "/missions/claim", { missionId: m.id }, k);
    expect(claim.statusCode).toBe(200);
    expect(await coinsOf(ctx.db, g.playerId)).toBe(coinsBefore + BigInt(m.rewardCoins));
    expect(await gemsOf(g.playerId)).toBe(1n);

    const replay = await post(ctx.app, g, "/missions/claim", { missionId: m.id }, k);
    expect(replay.json()).toEqual(claim.json());
    const again = await post(ctx.app, g, "/missions/claim", { missionId: m.id });
    expect(again.json().error.code).toBe("MISSION_ALREADY_CLAIMED");
    expect(await gemsOf(g.playerId)).toBe(1n);
  });

  it("resgates simultâneos pagam uma vez", async () => {
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    for (let i = 0; i < 10; i++) {
      ctx.clock.advance(10);
      await post(ctx.app, g, "/production/collect", {});
    }
    const m = (await missions(g)).missions.find(
      (x: { template: string }) => x.template === "collect_times",
    );
    const before = await coinsOf(ctx.db, g.playerId);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => post(ctx.app, g, "/missions/claim", { missionId: m.id })),
    );
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(await coinsOf(ctx.db, g.playerId)).toBe(before + BigInt(m.rewardCoins));
    expect(await gemsOf(g.playerId)).toBe(1n);
  });

  it("missão incompleta não paga; missão de ontem expira e o dia novo traz outras", async () => {
    const g = await newGuest(ctx.app);
    const today = (await missions(g)).missions[0];
    const early = await post(ctx.app, g, "/missions/claim", { missionId: today.id });
    expect(early.json().error.code).toBe("MISSION_NOT_COMPLETED");
    ctx.clock.advance(24 * 3_600);
    const tomorrow = await missions(g);
    expect(tomorrow.day).toBe("2026-01-02");
    expect(tomorrow.missions.map((m: { id: string }) => m.id)).not.toContain(today.id);
    const old = await post(ctx.app, g, "/missions/claim", { missionId: today.id });
    expect(old.json().error.code).toBe("MISSION_NOT_FOUND");
  });

  it("não dá para resgatar missão de outro jogador", async () => {
    const a = await newGuest(ctx.app);
    const b = await newGuest(ctx.app);
    const m = (await missions(a)).missions[0];
    const res = await post(ctx.app, b, "/missions/claim", { missionId: m.id });
    expect(res.json().error.code).toBe("MISSION_NOT_FOUND");
  });
});

describe("conquistas", () => {
  it("desbloqueia pelo estado do servidor e paga diamantes uma vez", async () => {
    const g = await newGuest(ctx.app);
    const locked = await post(ctx.app, g, "/achievements/claim", {
      achievementId: "first_business",
    });
    expect(locked.json().error.code).toBe("ACHIEVEMENT_LOCKED");

    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    const list = (await get(ctx.app, g, "/achievements")).json().achievements;
    expect(list.find((a: { id: string }) => a.id === "first_business")).toMatchObject({
      unlocked: true,
      claimed: false,
      progress: "1",
    });
    const claim = await post(ctx.app, g, "/achievements/claim", {
      achievementId: "first_business",
    });
    expect(claim.statusCode).toBe(200);
    expect(await gemsOf(g.playerId)).toBe(1n);
    const twice = await post(ctx.app, g, "/achievements/claim", {
      achievementId: "first_business",
    });
    expect(twice.json().error.code).toBe("ACHIEVEMENT_ALREADY_CLAIMED");
  });

  it("faturamento da vida conta só produção", async () => {
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    ctx.clock.advance(10);
    await post(ctx.app, g, "/production/collect", {});
    const earned = (await get(ctx.app, g, "/achievements"))
      .json()
      .achievements.find((a: { id: string }) => a.id === "earned_10k");
    expect(earned).toMatchObject({ progress: "10", target: "10000", unlocked: false });
  });
});

describe("ranking semanal (desafio dos 7 dias)", () => {
  async function earn(g: Guest, cycles: number) {
    await setCoins(ctx.db, g.playerId, 100n);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    for (let i = 0; i < cycles; i++) {
      ctx.clock.advance(10);
      await post(ctx.app, g, "/production/collect", {});
    }
  }

  it("ordena pelo faturamento da semana e marca o jogador", async () => {
    const [a, b, c] = [await newGuest(ctx.app), await newGuest(ctx.app), await newGuest(ctx.app)];
    await earn(a, 3);
    await earn(b, 5);
    await earn(c, 1);
    const res = (await get(ctx.app, a, "/leaderboard")).json();
    expect(res.entries.map((e: { score: string }) => e.score)).toEqual(["50", "30", "10"]);
    expect(res.me).toMatchObject({ rank: 2, score: "30", isMe: true });
    expect(res.week.start).toBe("2025-12-29T03:00:00.000Z");
  });

  it("semana nova zera o ranking; quem não faturou não aparece", async () => {
    const a = await newGuest(ctx.app);
    await earn(a, 2);
    ctx.clock.advance(7 * 24 * 3_600);
    const res = (await get(ctx.app, a, "/leaderboard")).json();
    expect(res.entries).toEqual([]);
    expect(res.me).toBeNull();
  });
});

describe("analytics e painel admin", () => {
  it("servidor registra eventos econômicos; cliente só envia os permitidos", async () => {
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    const ok = await post(
      ctx.app,
      g,
      "/analytics/events",
      {
        events: [
          { name: "tutorial_started" },
          { name: "screen_view", props: { screen: "missoes" } },
        ],
      },
      null,
    );
    expect(ok.statusCode).toBe(202);
    const forged = await post(
      ctx.app,
      g,
      "/analytics/events",
      {
        events: [{ name: "purchase_verified" }],
      },
      null,
    );
    expect(forged.statusCode).toBe(400);
    const names = (await ctx.db.analyticsEvent.findMany({ where: { playerId: g.playerId } })).map(
      (e) => e.name,
    );
    expect(names).toEqual(
      expect.arrayContaining([
        "player_created",
        "business_purchased",
        "tutorial_started",
        "screen_view",
      ]),
    );
  });

  it("admin exige token e mostra visão geral somente leitura", async () => {
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/presence", { district: "praia" });
    const denied = await ctx.app.inject({ method: "GET", url: "/api/admin/overview" });
    expect(denied.statusCode).toBe(401);
    const wrong = await ctx.app.inject({
      method: "GET",
      url: "/api/admin/overview",
      headers: { authorization: "Bearer errado" },
    });
    expect(wrong.statusCode).toBe(401);
    const auth = { authorization: `Bearer ${ADMIN_TOKEN}` };
    const overview = await ctx.app.inject({
      method: "GET",
      url: "/api/admin/overview",
      headers: auth,
    });
    expect(overview.statusCode).toBe(200);
    expect(overview.json()).toMatchObject({ players: 1, coinsInCirculation: "100" });
    const players = await ctx.app.inject({
      method: "GET",
      url: "/api/admin/players",
      headers: auth,
    });
    expect(players.json().players[0]).toMatchObject({ id: g.playerId, coins: "100" });
    const detail = await ctx.app.inject({
      method: "GET",
      url: `/api/admin/players/${g.playerId}`,
      headers: auth,
    });
    expect(detail.json().ledger[0]).toMatchObject({ reason: "initial_grant", delta: "100" });
    // "Código do jogador" (8 primeiros hex do id) encontra a conta, em maiúsculas ou minúsculas.
    await newGuest(ctx.app);
    const code = g.playerId.slice(0, 8).toUpperCase();
    const byCode = await ctx.app.inject({
      method: "GET",
      url: `/api/admin/players?search=${code}`,
      headers: auth,
    });
    expect(byCode.json().players.map((p: { id: string }) => p.id)).toEqual([g.playerId]);
  });
});
