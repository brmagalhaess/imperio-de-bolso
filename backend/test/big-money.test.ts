import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, get, newGuest, post, type TestContext } from "./helpers.js";

// Dinheiro sem teto (ADR 0033): acima de 9,2×10^18 (o antigo limite do BIGINT) tudo continua
// exato — saldo, ledger, compra e ranking.

let ctx: TestContext;
afterEach(async () => {
  await ctx?.close();
});

const HUGE = 10n ** 30n + 123n;

describe("dinheiro acima de 9 quintilhões", () => {
  it("saldo, compra, coleta e ranking com números de 31 dígitos", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await ctx.db.playerWallet.update({ where: { playerId: g.playerId }, data: { coins: HUGE } });
    const buy = await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    expect(buy.statusCode).toBe(201);
    const state = (await get(ctx.app, g, "/player/state")).json();
    expect(state.wallet.coins).toBe((HUGE - 100n).toString());
    await ctx.db.walletLedger.create({
      data: {
        playerId: g.playerId,
        currency: "COINS",
        delta: HUGE,
        balanceAfter: HUGE * 2n,
        reason: "production_collect",
        createdAt: ctx.clock.now,
      },
    });
    const lb = (await get(ctx.app, g, "/leaderboard")).json();
    expect(lb.me.score).toBe(HUGE.toString());
    expect(lb.league.me.score).toBe(HUGE.toString());
  });
});
