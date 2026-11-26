import { afterEach, describe, expect, it } from "vitest";
import { nextUpgradeCost } from "../src/economy/formulas.js";
import {
  coinsOf,
  createTestContext,
  newGuest,
  post,
  setCoins,
  type TestContext,
} from "./helpers.js";

let ctx: TestContext;
afterEach(async () => ctx?.close());

describe("evolução em lote (toques rápidos viram um comando só)", () => {
  it("sobe N níveis numa transação, cobrando cada nível, e para quando o saldo acaba", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    const def = await ctx.db.businessDefinition.findUniqueOrThrow({ where: { slug: "agua" } });
    // Saldo para exatamente 3 níveis (1→4).
    const three = [1, 2, 3].reduce((s, l) => s + nextUpgradeCost(def, l)!, 0n);
    await setCoins(ctx.db, g.playerId, three);
    const r = await post(ctx.app, g, "/businesses/upgrade", { businessSlug: "agua", times: 10 });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ level: 4, levels: 3 });
    expect(await coinsOf(ctx.db, g.playerId)).toBe(0n);
    const ledger = await ctx.db.walletLedger.count({
      where: { playerId: g.playerId, reason: { startsWith: "business_upgrade:agua:" } },
    });
    expect(ledger).toBe(3);
  });

  it("repetir o mesmo pedido (mesma Idempotency-Key) não cobra de novo", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await setCoins(ctx.db, g.playerId, 1_000_000n);
    const key = "11111111-1111-4111-8111-111111111111";
    const a = await post(
      ctx.app,
      g,
      "/businesses/upgrade",
      { businessSlug: "agua", times: 5 },
      key,
    );
    const b = await post(
      ctx.app,
      g,
      "/businesses/upgrade",
      { businessSlug: "agua", times: 5 },
      key,
    );
    expect(a.json().level).toBe(6);
    expect(b.json().level).toBe(6);
    const def = await ctx.db.businessDefinition.findUniqueOrThrow({ where: { slug: "agua" } });
    const five = [1, 2, 3, 4, 5].reduce((s, l) => s + nextUpgradeCost(def, l)!, 0n);
    expect(await coinsOf(ctx.db, g.playerId)).toBe(1_000_000n - five);
  });

  it("sem saldo nem para o primeiro nível: recusa com INSUFFICIENT_FUNDS", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await setCoins(ctx.db, g.playerId, 0n);
    const r = await post(ctx.app, g, "/businesses/upgrade", { businessSlug: "agua", times: 3 });
    expect(r.json().error.code).toBe("INSUFFICIENT_FUNDS");
  });

  it("loja: N compras do mesmo item num comando só, até onde os diamantes alcançam", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await ctx.db.playerWallet.update({ where: { playerId: g.playerId }, data: { gems: 25n } });
    // Turbo 1h custa 10 diamantes: pediu 3, cabem 2 → 2 horas de Turbo e sobram 5 diamantes.
    const r = await post(ctx.app, g, "/store/buy", { itemId: "turbo_1h", times: 3 });
    expect(r.statusCode).toBe(200);
    expect(r.json().times).toBe(2);
    expect(r.json().state.wallet.gems).toBe("5");
    expect(new Date(r.json().turboUntil).getTime()).toBe(ctx.clock.now.getTime() + 2 * 3_600_000);
  });
});
