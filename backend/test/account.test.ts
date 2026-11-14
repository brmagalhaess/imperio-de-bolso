import { afterEach, describe, expect, it } from "vitest";
import { revokePurchase } from "../src/services/purchases.js";
import {
  createTestContext,
  get,
  key,
  newGuest,
  post,
  setCoins,
  type TestContext,
} from "./helpers.js";

// Exclusão de conta (LGPD, ADR 0009).

let ctx: TestContext;

afterEach(async () => {
  await ctx?.close();
});

const GEMS_50 = "br.com.imperiodebolso.gems_50";
const VIP = "br.com.imperiodebolso.vip_monthly";
const del = (g: Parameters<typeof post>[1], confirm: unknown = "EXCLUIR") =>
  post(ctx.app, g, "/player/delete", { confirm }, null);

describe("exclusão de conta", () => {
  it("exige a confirmação digitada", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    expect((await del(g, "sim")).statusCode).toBe(400);
    expect((await post(ctx.app, g, "/player/delete", {}, null)).statusCode).toBe(400);
    expect(await ctx.db.player.count()).toBe(1);
  });

  it("apaga jogador e dados de jogo; token e credenciais antigas deixam de valer", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    const other = await newGuest(ctx.app);
    await setCoins(ctx.db, g.playerId, 50_000n);
    const bought = await post(ctx.app, g, "/businesses/purchase", {
      businessSlug: "quiosque_coco",
    });
    expect(bought.statusCode).toBe(201);
    expect(await ctx.db.playerBusiness.count({ where: { playerId: g.playerId } })).toBe(1);
    await post(ctx.app, g, "/analytics/events", { events: [{ name: "screen_view" }] }, null);
    await get(ctx.app, g, "/missions");
    expect(await ctx.db.analyticsEvent.count({ where: { playerId: g.playerId } })).toBeGreaterThan(
      0,
    );
    expect(await ctx.db.playerMission.count({ where: { playerId: g.playerId } })).toBe(3);

    const res = await del(g);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });

    const where = { playerId: g.playerId };
    expect(await ctx.db.player.count({ where: { id: g.playerId } })).toBe(0);
    expect(await ctx.db.playerWallet.count({ where })).toBe(0);
    expect(await ctx.db.walletLedger.count({ where })).toBe(0);
    expect(await ctx.db.playerBusiness.count({ where })).toBe(0);
    expect(await ctx.db.playerMission.count({ where })).toBe(0);
    expect(await ctx.db.analyticsEvent.count({ where })).toBe(0);
    expect(await ctx.db.idempotencyRecord.count({ where })).toBe(0);
    // Só a contagem anônima fica.
    const evt = await ctx.db.analyticsEvent.findFirst({ where: { name: "account_deleted" } });
    expect(evt).toMatchObject({ playerId: null });

    // O JWT ainda dentro da validade é recusado, e as credenciais de convidado também.
    expect((await get(ctx.app, g, "/player/state")).json().error.code).toBe("UNAUTHORIZED");
    const resume = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/guest",
      payload: { guestId: g.guestId, guestSecret: g.guestSecret },
    });
    expect(resume.json().error.code).toBe("INVALID_GUEST_CREDENTIALS");
    // Outras contas não são afetadas.
    expect((await get(ctx.app, other, "/player/state")).statusCode).toBe(200);
  });

  it("recibos ficam sem dono: diamantes não são reaproveitados; VIP é religado ao restaurar", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    const verify = (who: typeof g, productId: string, purchaseToken: string) =>
      post(ctx.app, who, "/purchases/verify", { store: "mock", productId, purchaseToken });
    await verify(g, GEMS_50, "mock-gemas");
    await verify(g, VIP, "mock-vip");
    await del(g);

    const receipts = await ctx.db.purchaseReceipt.findMany();
    expect(receipts).toHaveLength(2);
    expect(receipts.every((r) => r.playerId === null)).toBe(true);

    const fresh = await newGuest(ctx.app);
    const gems = await verify(fresh, GEMS_50, "mock-gemas");
    expect(gems.json().error.code).toBe("PURCHASE_OWNED_BY_OTHER");
    const vip = await verify(fresh, VIP, "mock-vip");
    expect(vip.statusCode).toBe(200);
    expect(vip.json().relinked).toBe(true);
    expect(vip.json().state.player.vipUntil).toBe("2026-01-31T12:00:00.000Z");
    // Repetir não duplica.
    expect((await verify(fresh, VIP, "mock-vip")).json().duplicate).toBe(true);
  });

  it("reembolso de compra de conta excluída registra a falta sem erro", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/purchases/verify", {
      store: "mock",
      productId: GEMS_50,
      purchaseToken: "mock-x",
    });
    await del(g);
    const r = await revokePurchase(ctx.db, "mock", "mock-x", ctx.clock.now);
    expect(r).toEqual({ alreadyRevoked: false, shortfall: "50" });
  });

  it("comando concorrente e exclusão não deixam carteira órfã", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await setCoins(ctx.db, g.playerId, 50_000n);
    const results = await Promise.all([
      post(ctx.app, g, "/businesses/purchase", { businessSlug: "quiosque_coco" }, key()),
      del(g),
    ]);
    // Ou a compra entra antes (e é apagada junto) ou chega depois e é recusada.
    expect([201, 401]).toContain(results[0].statusCode);
    expect(results[1].statusCode).toBe(200);
    expect(await ctx.db.playerWallet.count()).toBe(0);
    expect(await ctx.db.playerBusiness.count()).toBe(0);
  });
});
