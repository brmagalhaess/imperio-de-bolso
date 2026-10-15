import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, get, key, newGuest, post, type TestContext } from "./helpers.js";

// Denúncia de nome impróprio no ranking (diretriz 1.2 da App Store).

let ctx: TestContext;

afterEach(async () => {
  await ctx?.close();
});

describe("denunciar nome no ranking", () => {
  it("o ranking traz o id do jogador e 3 denúncias devolvem o nome escolhido ao padrão", async () => {
    ctx = await createTestContext();
    const target = await newGuest(ctx.app);
    const named = await post(ctx.app, target, "/player/name", { displayName: "Nome Feio" }, key());
    expect(named.statusCode).toBe(200);
    await ctx.db.walletLedger.create({
      data: {
        playerId: target.playerId,
        currency: "COINS",
        delta: 500n,
        balanceAfter: 500n,
        reason: "production_collect",
        createdAt: ctx.clock.now,
      },
    });
    const viewer = await newGuest(ctx.app);
    const lb = (await get(ctx.app, viewer, "/leaderboard")).json();
    expect(lb.entries[0]).toMatchObject({ playerId: target.playerId, displayName: "Nome Feio" });

    // Não pode denunciar a si mesmo; repetir a denúncia não conta duas vezes.
    const self = await post(ctx.app, target, "/players/report", { playerId: target.playerId });
    expect(self.statusCode).toBe(422);
    for (let i = 0; i < 2; i++) {
      const g = i === 0 ? viewer : await newGuest(ctx.app);
      expect(
        (await post(ctx.app, g, "/players/report", { playerId: target.playerId })).statusCode,
      ).toBe(202);
      await post(ctx.app, g, "/players/report", { playerId: target.playerId });
    }
    let p = await ctx.db.player.findUniqueOrThrow({ where: { id: target.playerId } });
    expect(p.displayName).toBe("Nome Feio");

    const third = await newGuest(ctx.app);
    await post(ctx.app, third, "/players/report", { playerId: target.playerId });
    p = await ctx.db.player.findUniqueOrThrow({ where: { id: target.playerId } });
    expect(p.displayName).toMatch(/^Empreendedor \d{4}$/);
    // Continua sem poder escolher outro nome.
    const again = await post(ctx.app, target, "/player/name", { displayName: "Outro" }, key());
    expect(again.statusCode).toBe(409);
  });
});
