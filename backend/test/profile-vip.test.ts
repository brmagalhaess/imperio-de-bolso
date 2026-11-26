import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateName } from "../src/services/profile.js";
import { createTestContext, get, newGuest, post, type Guest, type TestContext } from "./helpers.js";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.close();
});

const rename = (g: Guest, displayName: string) =>
  post(ctx.app, g, "/player/name", { displayName }, null);
const catalog = async (g: Guest, district = "praia") =>
  (await get(ctx.app, g, `/store/catalog?district=${district}`)).json();

describe("coleta antecipada na Loja", () => {
  it("mostra a estimativa de moedas do mapa e o uso de hoje do anúncio grátis", async () => {
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    let cat = await catalog(g);
    const ad = cat.items.find((i: { id: string }) => i.id === "ad_boost");
    expect(ad).toMatchObject({
      title: "Coleta antecipada de 5 min",
      estimateCoins: "300",
      usedToday: 0,
      dailyLimit: 10,
      nextAt: null,
    });
    expect(cat.items.find((i: { id: string }) => i.id === "boost_4h")).toMatchObject({
      title: "Coleta antecipada de 4 horas",
      estimateCoins: "14400",
    });
    const start = await post(ctx.app, g, "/ads/start", {
      placement: "ad_boost",
      district: "praia",
    });
    await post(ctx.app, g, "/ads/mock-complete", { sessionId: start.json().sessionId }, null);
    await post(ctx.app, g, "/ads/claim", { sessionId: start.json().sessionId });
    cat = await catalog(g);
    expect(cat.items.find((i: { id: string }) => i.id === "ad_boost").usedToday).toBe(1);
    expect(
      (await catalog(g, "cidade")).items.find((i: { id: string }) => i.id === "ad_boost")
        .estimateCoins,
    ).toBe("0");
  });
});

describe("recompensa diária do Passe VIP", () => {
  it("só para VIP, 5 diamantes, uma vez por dia", async () => {
    const g = await newGuest(ctx.app);
    const noVip = await post(ctx.app, g, "/vip/daily", {});
    expect(noVip.json().error.code).toBe("VIP_REQUIRED");
    await post(ctx.app, g, "/purchases/verify", {
      store: "mock",
      productId: "br.com.imperiodebolso.vip_monthly",
      purchaseToken: "mock-vip-diario",
    });
    expect((await catalog(g)).entitlements).toMatchObject({
      vipDailyGems: 5,
      vipDailyClaimed: false,
    });
    const first = await post(ctx.app, g, "/vip/daily", {});
    expect(first.json().state.wallet.gems).toBe("5");
    const again = await post(ctx.app, g, "/vip/daily", {});
    expect(again.json().error.code).toBe("VIP_DAILY_CLAIMED");
    expect((await catalog(g)).entitlements.vipDailyClaimed).toBe(true);
    ctx.clock.advance(24 * 3600);
    expect((await post(ctx.app, g, "/vip/daily", {})).json().state.wallet.gems).toBe("10");
  });
});

describe("troca de nome (uma única vez)", () => {
  it("valida tamanho, caracteres e palavras bloqueadas (inclusive disfarçadas)", () => {
    expect(validateName("  Bruno   Magnata ")).toBe("Bruno Magnata");
    for (const bad of [
      "ab",
      "x".repeat(21),
      "Nome<script>",
      "P0rr4 Total",
      "Rei da Buc3ta",
      "Admin",
    ]) {
      expect(() => validateName(bad), bad).toThrow();
    }
    expect(validateName("Paulo Cunha")).toBe("Paulo Cunha"); // "pau"/"cu" só como palavra inteira
  });

  it("troca uma vez, aparece no estado e não deixa trocar de novo", async () => {
    const g = await newGuest(ctx.app);
    expect((await get(ctx.app, g, "/player/state")).json().player.canChangeName).toBe(true);
    const ok = await rename(g, "Rei da Praia");
    expect(ok.statusCode).toBe(200);
    expect(ok.json().player).toMatchObject({ displayName: "Rei da Praia", canChangeName: false });
    const twice = await rename(g, "Outro Nome");
    expect(twice.json().error.code).toBe("NAME_ALREADY_CHANGED");
  });

  it("nome já usado por outro jogador é recusado (sem diferenciar maiúsculas)", async () => {
    const a = await newGuest(ctx.app);
    const b = await newGuest(ctx.app);
    await rename(a, "Magnata Supremo");
    const dup = await rename(b, "magnata supremo");
    expect(dup.json().error.code).toBe("NAME_TAKEN");
    expect((await rename(b, "Magnata Supremo 2")).statusCode).toBe(200);
  });

  it("pedidos simultâneos trocam o nome uma única vez", async () => {
    const g = await newGuest(ctx.app);
    const results = await Promise.all(
      ["Nome Um", "Nome Dois", "Nome Tres"].map((n) => rename(g, n)),
    );
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
  });
});
