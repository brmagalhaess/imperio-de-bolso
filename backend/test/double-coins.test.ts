import { afterEach, describe, expect, it } from "vitest";
import { speedPercentAt, workBetween } from "../src/economy/speed.js";
import { createTestContext, get, newGuest, post, type TestContext } from "./helpers.js";

let ctx: TestContext;
afterEach(async () => ctx?.close());

describe("Dobro de moedas (ADR 0025)", () => {
  const b = { level: 100, managerUnlocked: true }; // 100 + 25 + 5×50 = 375%
  const t0 = new Date("2026-10-18T12:00:00Z");
  const t1 = new Date(t0.getTime() + 3_600_000);

  it("multiplica a velocidade TOTAL por 2 (o Turbo só soma +100) e corta no fim da janela", () => {
    const ctxOn = { vipUntil: null, turboUntil: null, doubleFrom: t0, doubleUntil: t1 };
    expect(speedPercentAt(b, { vipUntil: null, turboUntil: null }, t0)).toBe(375);
    expect(speedPercentAt(b, ctxOn, t0)).toBe(750);
    expect(speedPercentAt(b, { ...ctxOn, turboFrom: t0, turboUntil: t1 }, t0)).toBe(950);
    // 2h de trabalho: 1h dobrada + 1h normal = 3h a 375%.
    const work = workBetween(b, ctxOn, t0.getTime(), t0.getTime() + 2 * 3_600_000);
    expect(work).toBe(Math.floor((3 * 3_600_000 * 375) / 100));
  });

  it("compra com recibo liga 1h (soma se já ativo) e a Loja conta as compras do mês", async () => {
    ctx = await createTestContext();
    ctx.clock.now = new Date("2026-10-18T15:00:00Z");
    const g = await newGuest(ctx.app);
    const item = () =>
      get(ctx.app, g, "/store/catalog?platform=ios").then((r) =>
        r.json().items.find((i: { id: string }) => i.id === "double_1h"),
      );
    expect(await item()).toMatchObject({ priceBRL: "129,90", monthlyLimit: 3, usedThisMonth: 0 });

    const buy = (token: string) =>
      post(ctx.app, g, "/purchases/verify", {
        store: "mock",
        productId: "br.com.imperiodebolso.double_1h",
        purchaseToken: token,
      });
    const first = await buy("mock-double-1");
    expect(first.statusCode).toBe(201);
    expect(first.json().state.player.doubleUntil).toBe("2026-10-18T16:00:00.000Z");
    const second = await buy("mock-double-2");
    expect(second.json().state.player.doubleUntil).toBe("2026-10-18T17:00:00.000Z");
    expect((await item()).usedThisMonth).toBe(2);

    ctx.clock.now = new Date("2026-11-01T03:30:00Z"); // novo mês em Brasília
    expect((await item()).usedThisMonth).toBe(0);
  });

  it("sem compras na plataforma o Dobro não aparece", async () => {
    ctx = await createTestContext({ PURCHASES_ENABLED: "false", PURCHASES_PLATFORMS: "ios" });
    const g = await newGuest(ctx.app);
    const cat = (await get(ctx.app, g, "/store/catalog?platform=android")).json();
    expect(cat.items.some((i: { id: string }) => i.id === "double_1h")).toBe(false);
  });
});
