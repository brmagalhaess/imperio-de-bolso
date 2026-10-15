import { afterEach, describe, expect, it } from "vitest";
import { BUSINESS_CATALOG } from "../src/economy/catalog.js";
import { starsFor, withPrestige } from "../src/economy/prestige.js";
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

// Prestígio — "Vender o império" (ADR 0011).

let ctx: TestContext;

afterEach(async () => {
  await ctx?.close();
});

const ALL = BUSINESS_CATALOG.map((b) => b.slug);

/** Compra os negócios (em ordem de mapa) e, se pedido, contrata os ajudantes. */
async function buildEmpire(g: Guest, slugs: string[], helpers: boolean) {
  await setCoins(ctx.db, g.playerId, 10n ** 15n);
  for (const slug of slugs) {
    const r = await post(ctx.app, g, "/businesses/purchase", { businessSlug: slug });
    expect(r.statusCode).toBe(201);
    if (helpers) {
      const h = await post(ctx.app, g, "/managers/hire", { businessSlug: slug });
      expect(h.statusCode).toBe(200);
    }
  }
}

/** Simula faturamento de produção (o que conta para as estrelas). */
async function earn(g: Guest, amount: bigint) {
  await ctx.db.walletLedger.create({
    data: {
      playerId: g.playerId,
      currency: "COINS",
      delta: amount,
      balanceAfter: amount,
      reason: "production_collect",
      createdAt: ctx.clock.now,
    },
  });
}

describe("fórmula das estrelas", () => {
  it("estrelas = ⌊20 × log10(faturamento ÷ 1 mi)⌋ e cada estrela vale +2%", () => {
    expect(starsFor(0n)).toBe(0);
    expect(starsFor(999_999n)).toBe(0);
    expect(starsFor(1_000_000n)).toBe(0);
    expect(starsFor(10_000_000n)).toBe(20);
    expect(starsFor(50_000_000n)).toBe(33);
    expect(starsFor(1_000_000_000n)).toBe(60);
    expect(starsFor(1_000_000_000_000n)).toBe(120);
    expect(starsFor(9_000_000_000_000_000_000n)).toBe(259);
    expect(starsFor(10n ** 30n)).toBe(480);
    expect(withPrestige(100n, 7)).toBe(114n);
    expect(withPrestige(10n, 7)).toBe(11n);
    expect(withPrestige(10n, 0)).toBe(10n);
  });
});

describe("vender o império", () => {
  it("só libera com todos os negócios e todos os ajudantes, mesmo com faturamento", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await earn(g, 50_000_000n);
    const view = (await get(ctx.app, g, "/prestige")).json();
    expect(view).toMatchObject({ requirementMet: false, starsToGain: 33, available: false });
    const res = await post(ctx.app, g, "/prestige", {});
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("PRESTIGE_NOT_AVAILABLE");

    // Todos os negócios comprados, mas sem ajudantes: ainda não.
    await buildEmpire(g, ALL, false);
    const noHelpers = (await get(ctx.app, g, "/prestige")).json();
    expect(noHelpers).toMatchObject({
      requires: "imperio_completo",
      totalBusinesses: ALL.length,
      ownedBusinesses: ALL.length,
      hiredHelpers: 0,
      available: false,
    });
  });

  it("recomeça da praia, soma estrelas, mantém diamantes e aplica o bônus no lucro", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await buildEmpire(g, ALL, true);
    await ctx.db.playerWallet.update({ where: { playerId: g.playerId }, data: { gems: 42n } });
    await earn(g, 50_000_000n);

    const before = (await get(ctx.app, g, "/prestige")).json();
    expect(before).toMatchObject({
      available: true,
      hiredHelpers: ALL.length,
      starsToGain: 33,
      nextBonusPercent: 66,
    });

    const k = key();
    const res = await post(ctx.app, g, "/prestige", {}, k);
    expect(res.statusCode).toBe(200);
    expect(res.json().gained).toBe(33);
    // Repetir com a mesma chave não vende de novo.
    const again = await post(ctx.app, g, "/prestige", {}, k);
    expect(again.json().gained).toBe(33);

    const state = (await get(ctx.app, g, "/player/state")).json();
    expect(state.player).toMatchObject({ prestigeStars: 33, prestigeBonusPercent: 66 });
    expect(state.wallet).toEqual({ coins: "100", gems: "42" });
    expect(state.businesses.every((b: { owned: boolean }) => !b.owned)).toBe(true);
    expect(state.districts.map((d: { unlocked: boolean }) => d.unlocked)).toEqual([
      true,
      ...Array(7).fill(false),
    ]);
    // Lucro com bônus: água 10 → 16 (+66%).
    const agua = state.businesses.find((b: { slug: string }) => b.slug === "agua");
    expect(agua.profitPerCycle).toBe("16");

    // Coleta credita o lucro com bônus.
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    ctx.clock.advance(10);
    const collect = await post(ctx.app, g, "/production/collect", { businessSlug: "agua" });
    expect(collect.statusCode).toBe(200);
    expect(await coinsOf(ctx.db, g.playerId)).toBe(16n);

    // Faturamento recomeça do zero depois de vender; conquista "Investidor".
    const after = (await get(ctx.app, g, "/prestige")).json();
    expect(after).toMatchObject({ stars: 33, count: 1, starsToGain: 0, available: false });
    const ach = (await get(ctx.app, g, "/achievements")).json().achievements;
    expect(ach.find((a: { id: string }) => a.id === "first_prestige")).toMatchObject({
      unlocked: true,
    });
  });

  it("ajudantes fora do mapa também rendem com o bônus", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await ctx.db.player.update({ where: { id: g.playerId }, data: { prestigeStars: 50 } });
    await setCoins(ctx.db, g.playerId, 1_000n);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await post(ctx.app, g, "/managers/hire", { businessSlug: "agua" });
    await setCoins(ctx.db, g.playerId, 0n);
    ctx.clock.advance(100); // 10 ciclos fora do mapa (sem presença)
    const res = await post(ctx.app, g, "/presence", { district: "praia" });
    // 10 de lucro × 2 (+100% com 50 estrelas) × 12 ciclos (100 s × 1,25 do ajudante).
    expect(res.json().total).toBe("240");
  });
});
