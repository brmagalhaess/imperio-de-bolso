import { afterEach, describe, expect, it } from "vitest";
import {
  BUNDLES,
  easter,
  holidayBundleFor,
  holidays,
  weeklyBundles,
} from "../src/economy/bundles.js";
import { createTestContext, get, newGuest, post, type TestContext } from "./helpers.js";

let ctx: TestContext;
afterEach(async () => ctx?.close());

const day = (d: Date) => d.toISOString().slice(0, 10);

describe("pacotes promocionais: calendário e rodízio (ADR 0024)", () => {
  it("feriados móveis e fixos de 2026/2027", () => {
    expect(day(easter(2026))).toBe("2026-04-05");
    expect(day(easter(2027))).toBe("2027-03-28");
    const h = Object.fromEntries(holidays(2026).map((x) => [x.id, day(x.date)]));
    expect(h).toMatchObject({
      carnaval: "2026-02-17",
      pascoa: "2026-04-05",
      dia_das_maes: "2026-05-10",
      dia_dos_pais: "2026-08-09",
      black_friday: "2026-11-27",
      natal: "2026-12-25",
    });
  });

  it("pacote de feriado só na semana do feriado (segunda a segunda, Brasília)", () => {
    expect(holidayBundleFor(new Date("2026-12-23T12:00:00Z"))?.bundle.id).toBe("natal");
    expect(holidayBundleFor(new Date("2026-11-24T12:00:00Z"))?.bundle.id).toBe("black_friday");
    expect(holidayBundleFor(new Date("2026-10-20T12:00:00Z"))).toBeNull(); // sem feriado
    // Domingo 23:30 de Brasília ainda é a semana anterior.
    expect(holidayBundleFor(new Date("2026-12-28T02:30:00Z"))?.bundle.id).toBe("natal");
  });

  it("3 por semana, um de cada faixa, e todos os 9 aparecem no rodízio", () => {
    const seen = new Set<string>();
    for (let w = 0; w < 12; w++) {
      const list = weeklyBundles(new Date(Date.UTC(2026, 9, 19 + 7 * w, 15)));
      expect(list.map((x) => x.tier)).toEqual(["low", "mid", "high"]);
      list.forEach((x) => seen.add(x.id));
    }
    expect(seen.size).toBe(9);
    expect(BUNDLES.filter((x) => x.kind === "holiday")).toHaveLength(10);
  });
});

describe("pacotes promocionais: vitrine e entrega", () => {
  it("vitrine ≤ 5, compra entrega tudo e some até a semana seguinte; Kit Iniciante 1x", async () => {
    ctx = await createTestContext();
    ctx.clock.now = new Date("2026-12-23T15:00:00Z"); // semana do Natal
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });

    const cat = (await get(ctx.app, g, "/store/catalog?platform=ios")).json();
    const ids = cat.offers.map((o: { id: string }) => o.id);
    expect(cat.offers.length).toBeLessThanOrEqual(5);
    expect(ids[0]).toBe("natal");
    expect(ids).toContain("iniciante");
    expect(cat.offers[0].endsAt).toBe("2026-12-28T03:00:00.000Z");

    const natal = BUNDLES.find((x) => x.id === "natal")!;
    const buy = await post(ctx.app, g, "/purchases/verify", {
      store: "mock",
      productId: natal.productId,
      purchaseToken: "mock-natal-1",
    });
    expect(buy.statusCode).toBe(201);
    expect(buy.json().gems).toBe("2400");
    const state = buy.json().state;
    expect(state.wallet.gems).toBe("2400");
    expect(new Date(state.player.autoCollectUntil).getTime()).toBe(
      ctx.clock.now.getTime() + 14 * 24 * 3_600_000,
    );

    const after = (await get(ctx.app, g, "/store/catalog?platform=ios")).json();
    expect(after.offers.map((o: { id: string }) => o.id)).not.toContain("natal");

    // Império Express entrega 12 h de produção do mapa na hora.
    const express = BUNDLES.find((x) => x.id === "express")!;
    const ex = await post(ctx.app, g, "/purchases/verify", {
      store: "mock",
      productId: express.productId,
      purchaseToken: "mock-express-1",
      district: "praia",
    });
    expect(BigInt(ex.json().coins)).toBeGreaterThan(0n);

    const starter = BUNDLES.find((x) => x.id === "iniciante")!;
    await post(ctx.app, g, "/purchases/verify", {
      store: "mock",
      productId: starter.productId,
      purchaseToken: "mock-start-1",
    });
    ctx.clock.now = new Date("2027-01-06T15:00:00Z"); // semanas depois
    const later = (await get(ctx.app, g, "/store/catalog?platform=ios")).json();
    const laterIds = later.offers.map((o: { id: string }) => o.id);
    expect(laterIds).not.toContain("iniciante");
    expect(laterIds).not.toContain("natal");
  });

  it("sem compras na plataforma não há vitrine", async () => {
    ctx = await createTestContext({ PURCHASES_ENABLED: "false", PURCHASES_PLATFORMS: "ios" });
    const g = await newGuest(ctx.app);
    const cat = (await get(ctx.app, g, "/store/catalog?platform=android")).json();
    expect(cat.offers).toEqual([]);
  });
});
