import { afterEach, describe, expect, it } from "vitest";
import {
  baseSpeedPercent,
  effectiveCycleMs,
  speedPercentAt,
  workBetween,
} from "../src/economy/speed.js";
import {
  coinsOf,
  createTestContext,
  get,
  newGuest,
  post,
  setCoins,
  type Guest,
  type TestContext,
} from "./helpers.js";

// Aceleradores de produção (ADR 0013): ajudante, marcos de nível, VIP e Turbo — tudo soma.

let ctx: TestContext;

afterEach(async () => {
  await ctx?.close();
});

const at = (s: number) => new Date(Date.UTC(2026, 0, 1) + s * 1000);

describe("velocidade (cálculo)", () => {
  it("soma ajudante, marcos de nível, VIP e Turbo", () => {
    expect(baseSpeedPercent({ level: 1, managerUnlocked: false })).toBe(100);
    expect(baseSpeedPercent({ level: 9, managerUnlocked: true })).toBe(125);
    expect(baseSpeedPercent({ level: 10, managerUnlocked: true })).toBe(175);
    expect(baseSpeedPercent({ level: 100, managerUnlocked: true })).toBe(375);
    const all = { vipUntil: at(3600), turboFrom: at(0), turboUntil: at(3600) };
    expect(speedPercentAt({ level: 100, managerUnlocked: true }, all, at(10))).toBe(525);
    expect(effectiveCycleMs(10, 200)).toBe(5_000);
    expect(effectiveCycleMs(1, 525)).toBe(1_000); // nunca abaixo de 1 s
  });

  it("trabalho conta cada trecho com a velocidade que tinha (Turbo acabando no meio)", () => {
    const b = { level: 1, managerUnlocked: true };
    const turbo = { vipUntil: null, turboFrom: at(0), turboUntil: at(3600) };
    // 1 h com 225% + 1 h com 125% = 3,5 h de trabalho.
    expect(workBetween(b, turbo, at(0).getTime(), at(7200).getTime())).toBe(3.5 * 3_600_000);
    // Turbo comprado depois: o trecho anterior não acelera.
    const later = { vipUntil: null, turboFrom: at(3600), turboUntil: at(7200) };
    expect(workBetween(b, later, at(0).getTime(), at(7200).getTime())).toBe(3.5 * 3_600_000);
  });
});

async function setGems(playerId: string, gems: bigint) {
  await ctx.db.playerWallet.update({ where: { playerId }, data: { gems } });
}

async function waterWithHelper(): Promise<Guest> {
  const g = await newGuest(ctx.app);
  await setCoins(ctx.db, g.playerId, 1_000n);
  await post(ctx.app, g, "/presence", { district: "praia" });
  await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
  await post(ctx.app, g, "/managers/hire", { businessSlug: "agua" });
  return g;
}

const agua = async (g: Guest) =>
  (await get(ctx.app, g, "/player/state"))
    .json()
    .businesses.find((b: { slug: string }) => b.slug === "agua");

describe("Turbo da Loja", () => {
  it("compra com diamantes: produção 2× e ciclo mais curto na hora", async () => {
    ctx = await createTestContext();
    const g = await waterWithHelper();
    await setGems(g.playerId, 50n);
    const res = await post(ctx.app, g, "/store/buy", { itemId: "turbo_1h" });
    expect(res.statusCode).toBe(200);
    expect(res.json().state.player.turboUntil).toBe(
      new Date(ctx.clock.now.getTime() + 3_600_000).toISOString(),
    );
    expect(await agua(g)).toMatchObject({ speedPercent: 225, baseCycleSeconds: 10 });
    expect((await agua(g)).cycleSeconds).toBeCloseTo(4.444, 2);
    // Comprar de novo soma tempo.
    const again = await post(ctx.app, g, "/store/buy", { itemId: "turbo_1h" });
    expect(again.json().turboUntil).toBe(
      new Date(ctx.clock.now.getTime() + 7_200_000).toISOString(),
    );
  });

  it("AFK com Turbo que acaba no meio: cada trecho na sua velocidade", async () => {
    ctx = await createTestContext();
    const g = await waterWithHelper();
    await setGems(g.playerId, 50n);
    await post(ctx.app, g, "/store/buy", { itemId: "turbo_1h" });
    await post(ctx.app, g, "/presence", { district: "cidade" });
    const before = await coinsOf(ctx.db, g.playerId);
    ctx.clock.advance(7_200); // 2 h fora: 1 h a 225% + 1 h a 125% = 3,5 h → 1.260 ciclos
    const back = await post(ctx.app, g, "/presence", { district: "praia" });
    expect(back.json().total).toBe("12600");
    expect(await coinsOf(ctx.db, g.playerId)).toBe(before + 12_600n);
  });

  it("coleta manual fica pronta antes com o Turbo", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await setCoins(ctx.db, g.playerId, 1_000n);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await setGems(g.playerId, 50n);
    await post(ctx.app, g, "/store/buy", { itemId: "turbo_1h" });
    ctx.clock.advance(5); // ciclo de 10 s a 200% = 5 s
    const res = await post(ctx.app, g, "/production/collect", { businessSlug: "agua" });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe("10");
  });

  it("marco de nível 10 acelera o negócio (+50%)", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await setCoins(ctx.db, g.playerId, 1_000_000n);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    for (let i = 0; i < 9; i++) {
      await post(ctx.app, g, "/businesses/upgrade", { businessSlug: "agua" });
    }
    expect(await agua(g)).toMatchObject({ level: 10, speedPercent: 150 });
  });
});
