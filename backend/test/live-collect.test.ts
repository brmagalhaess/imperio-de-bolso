import { afterEach, describe, expect, it } from "vitest";
import { pickDailyMissions } from "../src/economy/missions.js";
import {
  coinsOf,
  createTestContext,
  get,
  newGuest,
  post,
  setCoins,
  type TestContext,
} from "./helpers.js";

// Auto-coleta ao vivo no mapa aberto e missões por fase do jogador.

let ctx: TestContext;

afterEach(async () => {
  await ctx?.close();
});

describe("auto-coleta ao vivo", () => {
  it("antes de melhorar, o servidor paga os ciclos já completos dos ajudantes do mapa", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await setCoins(ctx.db, g.playerId, 1_000n);
    await post(ctx.app, g, "/presence", { district: "praia" });
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await post(ctx.app, g, "/managers/hire", { businessSlug: "agua" });
    await ctx.db.player.update({
      where: { id: g.playerId },
      data: { autoCollectUntil: new Date(ctx.clock.now.getTime() + 86_400_000) },
    });
    await post(ctx.app, g, "/presence", { district: "praia" }); // auto-coleta liga no mapa
    await setCoins(ctx.db, g.playerId, 200n);

    ctx.clock.advance(30); // 3 ciclos de 10 s (lucro 10) — ainda sem sinal de presença
    const state = (await get(ctx.app, g, "/player/state")).json();
    const agua = state.businesses.find((b: { slug: string }) => b.slug === "agua");
    expect(agua).toMatchObject({ automatic: true, pendingAmount: "30" });

    const up = await post(ctx.app, g, "/businesses/upgrade", { businessSlug: "agua" });
    expect(up.statusCode).toBe(200);
    // 200 + 30 dos ciclos − 115 da melhoria; os mesmos ciclos não são pagos de novo.
    expect(await coinsOf(ctx.db, g.playerId)).toBe(115n);
    const again = await post(ctx.app, g, "/presence", { district: "praia" });
    expect(again.json().total).toBe("0");
  });
});

describe("missões por fase", () => {
  const advanced = {
    incomePerSecond: 50_000,
    ownedCount: 18,
    canBuy: true,
    canHire: false,
    hasHelper: true,
    cityUnlocked: true,
    manualCount: 0,
    cheapestBuy: 8_500_000_000,
    cheapestHire: null,
    coins: 1_000_000,
  };

  it("jogador evoluído não recebe missões de iniciante nem as impossíveis", () => {
    for (const day of ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]) {
      const ids = pickDailyMissions("p1", day, advanced).map((t) => t.id);
      expect(ids).toHaveLength(3);
      expect(ids).not.toContain("collect_times"); // tudo com auto-coleta: sem moeda para tocar
      expect(ids).not.toContain("buy_business"); // 8,5 bi não cabe em 30 min de renda
      expect(ids).not.toContain("visit_city");
      expect(ids.filter((id) => id.startsWith("earn")).length).toBeLessThanOrEqual(1);
    }
  });

  it("alvos crescem com a fase", async () => {
    const { MISSION_TEMPLATES } = await import("../src/economy/missions.js");
    const upgrade = MISSION_TEMPLATES.find((t) => t.id === "upgrade_times")!;
    expect(upgrade.target({ ...advanced, ownedCount: 2 })).toBe(5n);
    expect(upgrade.target(advanced)).toBe(50n);
  });
});
