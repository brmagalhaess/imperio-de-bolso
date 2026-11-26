import { afterEach, describe, expect, it } from "vitest";
import { evolutionMult, evolutionOf, nextEvolutionLevel } from "../src/economy/evolution.js";
import { profitPerCycle } from "../src/economy/formulas.js";
import {
  helperKind,
  helperOfflineExtraMs,
  helperProfitPercent,
  helperSpeedPoints,
  helperUpgradeCost,
} from "../src/economy/helpers.js";
import { seasonAt, seasonPrize, SEASON_EPOCH } from "../src/economy/seasons.js";
import {
  createTestContext,
  get,
  newGuest,
  openMaps,
  post,
  setCoins,
  type Guest,
  type TestContext,
} from "./helpers.js";

let ctx: TestContext;
afterEach(async () => {
  await ctx?.close();
});

const stateOf = async (g: Guest) => (await get(ctx.app, g, "/player/state")).json();
const biz = (state: { businesses: { slug: string }[] }, slug: string) =>
  state.businesses.find((b) => b.slug === slug) as unknown as Record<string, any>;

describe("evolução (ADR 0035)", () => {
  it("5 evoluções pelas faixas de nível, lucro ×3 em cada", () => {
    expect([1, 9, 10, 24, 25, 49, 50, 99, 100].map(evolutionOf)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5,
    ]);
    expect([1, 10, 25, 50, 100].map(evolutionMult)).toEqual([1n, 3n, 9n, 27n, 81n]);
    expect(nextEvolutionLevel(1)).toBe(10);
    expect(nextEvolutionLevel(100)).toBeNull();
    const def = { cost: 100n, revenue: 10n, operatingCost: 0n, maxLevel: 100 };
    expect(profitPerCycle(def, 9)).toBe(21n); // 10 × 1,1^8
    expect(profitPerCycle(def, 10)).toBe(24n * 3n); // 10 × 1,1^9 = 24, ×3
  });

  it("estrelas de evolução: 1 na compra e 1 por evolução, no total e na temporada", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await setCoins(ctx.db, g.playerId, 10n ** 9n);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    let s = await stateOf(g);
    expect(s.player.evoStars).toBe(1);
    expect(biz(s, "agua")).toMatchObject({ evolution: 1, nextEvolutionLevel: 10 });
    const up = await post(ctx.app, g, "/businesses/upgrade", { businessSlug: "agua", times: 30 });
    s = up.json().state;
    expect(biz(s, "agua")).toMatchObject({ level: 31, evolution: 3, nextEvolutionLevel: 50 });
    expect(s.player.evoStars).toBe(3);
    expect(s.districts[0]).toMatchObject({ stars: 3, maxStars: 30, owned: 1, maxed: 0 });
    const season = (await get(ctx.app, g, "/leaderboard/season")).json();
    expect(season.me).toMatchObject({ rank: 1, score: "3", isMe: true });
    expect(season.season).toMatchObject({ number: seasonAt(ctx.clock.now).number, days: 20 });
    const evo = (await get(ctx.app, g, "/leaderboard/evolution")).json();
    expect(evo.me).toMatchObject({ rank: 1, score: "3" });
  });

  it("jogador antigo: estrelas contadas pelas evoluções que já tinha", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await setCoins(ctx.db, g.playerId, 10n ** 6n);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await ctx.db.playerBusiness.updateMany({
      where: { playerId: g.playerId },
      data: { level: 60 },
    });
    await ctx.db.player.update({ where: { id: g.playerId }, data: { evoStars: null } });
    expect((await stateOf(g)).player.evoStars).toBe(4);
  });
});

describe("ajudantes com nível (ADR 0035)", () => {
  it("especialidades e preços", () => {
    expect([0, 1, 2].map(helperKind)).toEqual(["receita", "tempo", "noturno"]);
    expect(helperProfitPercent({ businessId: 0, managerLevel: 10 })).toBe(180);
    expect(helperSpeedPoints({ businessId: 1, managerLevel: 10 })).toBe(270);
    expect(helperOfflineExtraMs({ businessId: 2, managerLevel: 3 })).toBe(2 * 3_600_000);
    expect(helperProfitPercent({ businessId: 2, managerLevel: 3 })).toBe(16);
    expect(helperProfitPercent({ businessId: 0, managerLevel: 1 })).toBe(0);
    expect(helperUpgradeCost(150n, 2)).toBe(600n);
    expect(helperUpgradeCost(150n, 10)).toBe(150n * 4n ** 9n);
    expect(helperUpgradeCost(150n, 11)).toBeNull();
  });

  it("evoluir o ajudante cobra, sobe o nível e aplica o bônus da especialidade", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await openMaps(ctx.db, g.playerId);
    await setCoins(ctx.db, g.playerId, 10n ** 12n);
    const up = (slug: string) => post(ctx.app, g, "/managers/upgrade", { businessSlug: slug });
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    expect((await up("agua")).json().error.code).toBe("MANAGER_NOT_HIRED");
    await post(ctx.app, g, "/managers/hire", { businessSlug: "agua" });
    let s = await stateOf(g);
    const before = biz(s, "agua");
    expect(before.helper).toMatchObject({ level: 1, maxLevel: 10, nextCost: "600" });
    const coins = BigInt(s.wallet.coins);
    const r = await up("agua");
    expect(r.statusCode).toBe(200);
    s = r.json().state;
    const after = biz(s, "agua");
    expect(after.helper.level).toBe(2);
    expect(BigInt(s.wallet.coins)).toBe(coins - 600n);
    // Cada especialidade melhora a sua parte.
    if (after.helper.kind === "receita") {
      expect(after.profitPerCycle).toBe("12");
    } else if (after.helper.kind === "tempo") {
      expect(after.speedPercent).toBe(before.speedPercent + 30);
    } else {
      expect(after.helper.offlineHours).toBe(5);
    }
    for (let i = 0; i < 8; i++) expect((await up("agua")).statusCode).toBe(200);
    expect((await up("agua")).json().error.code).toBe("MANAGER_MAX_LEVEL");
  });
});

describe("temporada e desafios (ADR 0035)", () => {
  it("temporadas de 20 dias e faixas de prêmio", () => {
    const s1 = seasonAt(SEASON_EPOCH);
    expect(s1.number).toBe(1);
    expect(s1.end.getTime() - s1.start.getTime()).toBe(20 * 86_400_000);
    expect(seasonAt(new Date(s1.end.getTime())).number).toBe(2);
    expect([1, 2, 3, 7, 50].map((r) => seasonPrize(r, 30))).toEqual([1000, 600, 400, 200, 80]);
    expect(seasonPrize(51, 30)).toBe(20);
    expect(seasonPrize(51, 5)).toBe(0);
  });

  it("fechada a temporada, o prêmio aparece no pódio e é resgatado", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    // O relógio de teste começa antes da 1ª temporada: vai para o 2º dia dela.
    const toEpoch = Math.ceil((SEASON_EPOCH.getTime() - ctx.clock.now.getTime()) / 1000);
    ctx.clock.advance(Math.max(0, toEpoch) + 86_400);
    await setCoins(ctx.db, g.playerId, 10n ** 9n);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await post(ctx.app, g, "/businesses/upgrade", { businessSlug: "agua", times: 30 });
    const n = seasonAt(ctx.clock.now).number;
    ctx.clock.advance(20 * 86_400);
    const pending = (await get(ctx.app, g, "/rewards/weekly")).json().pending;
    const prize = pending.find((p: { kind: string }) => p.kind === "temporada");
    expect(prize).toMatchObject({ week: `T${n}`, rank: 1, gems: 1000 });
    const claim = await post(ctx.app, g, "/rewards/weekly/claim", {
      week: `T${n}`,
      kind: "temporada",
    });
    expect(claim.statusCode).toBe(200);
    expect(claim.json().state.wallet.gems).toBe("1000");
  });

  it("desafios da semana: 3 por semana, somam progresso e pagam diamantes", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    const list = (await get(ctx.app, g, "/missions")).json();
    expect(list.challenges.items).toHaveLength(3);
    expect(list.challenges.items.every((c: { rewardGems: number }) => c.rewardGems === 8)).toBe(
      true,
    );
    const first = await ctx.db.playerMission.findFirstOrThrow({
      where: { playerId: g.playerId, template: { startsWith: "w_" } },
    });
    await ctx.db.playerMission.update({
      where: { id: first.id },
      data: { progress: first.target },
    });
    const claim = await post(ctx.app, g, "/missions/claim", { missionId: first.id });
    expect(claim.statusCode).toBe(200);
    expect(claim.json().state.wallet.gems).toBe("8");
  });
});

describe("convide amigos (ADR 0035)", () => {
  it("quem usa o código ganha na hora; quem convidou ganha quando o amigo evolui", async () => {
    ctx = await createTestContext();
    const host = await newGuest(ctx.app);
    const friend = await newGuest(ctx.app);
    const code = (await get(ctx.app, host, "/invites")).json().code;
    expect(code).toBe(host.playerId.slice(0, 8).toUpperCase());
    const redeem = (g: Guest, c: string) => post(ctx.app, g, "/invites/redeem", { code: c });
    expect((await redeem(host, code)).json().error.code).toBe("INVITE_SELF");
    expect((await redeem(friend, "zzzzzzzz")).json().error.code).toBe("INVITE_INVALID");
    const ok = await redeem(friend, code.toLowerCase());
    expect(ok.statusCode).toBe(200);
    expect(ok.json().state.wallet.gems).toBe("20");
    expect((await redeem(friend, code)).json().error.code).toBe("INVITE_ALREADY_USED");
    // Convite cruzado não vale.
    const back = (await get(ctx.app, friend, "/invites")).json().code;
    expect((await redeem(host, back)).json().error.code).toBe("INVITE_SELF");
    // Amigo ainda sem estrelas: nada para resgatar.
    const claim = () => post(ctx.app, host, "/invites/claim", {});
    expect((await claim()).json().error.code).toBe("INVITE_NOTHING_TO_CLAIM");
    await ctx.db.player.update({ where: { id: friend.playerId }, data: { evoStars: 20 } });
    expect((await get(ctx.app, host, "/invites")).json()).toMatchObject({
      friends: 1,
      claimable: 1,
      claimableGems: 40,
    });
    const paid = await claim();
    expect(paid.json()).toMatchObject({ gems: 40, friends: 1 });
    expect(paid.json().state.wallet.gems).toBe("40");
    expect((await claim()).json().error.code).toBe("INVITE_NOTHING_TO_CLAIM");
  });
});
