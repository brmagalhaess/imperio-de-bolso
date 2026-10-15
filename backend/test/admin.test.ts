import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_TOKEN,
  createTestContext,
  key,
  newGuest,
  post,
  type TestContext,
} from "./helpers.js";

// Painel admin (ADR 0021): visão geral do jogo atual, economia, ranking e moderação de nomes.

let ctx: TestContext;
const auth = { authorization: `Bearer ${ADMIN_TOKEN}` };
const admin = (method: "GET" | "POST", url: string) =>
  ctx.app.inject({ method, url: `/api/admin${url}`, headers: auth });

afterEach(async () => {
  await ctx?.close();
});

describe("painel admin", () => {
  it("visão geral traz funil por mapa, retenção, reforços e denúncias abertas", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    const o = (await admin("GET", "/overview")).json();
    expect(o).toMatchObject({ players: 1, openReports: 0, weekendEvent: null });
    expect(o.mapFunnel).toHaveLength(8);
    expect(o.mapFunnel[0]).toEqual({ district: "praia", players: 1 });
    expect(o.prestige).toEqual({ players: 0, sales: 0, stars: 0 });
    expect(o.boosts).toEqual({ autoCollect: 0, turbo: 0, vip: 0 });
    expect(o.today).toMatchObject({ missionsClaimed: 0, gemsSpent: "0" });
  });

  it("economia lista os 67 negócios com donos, ajudantes e faixas visuais", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    const e = (await admin("GET", "/economy")).json();
    expect(e.businesses).toHaveLength(67);
    expect(e.businesses[0]).toMatchObject({
      slug: "agua",
      owners: 1,
      helpers: 0,
      tiers: [1, 0, 0, 0, 0],
    });
    expect(e.flows7d.some((f: { reason: string }) => f.reason === "initial_grant")).toBe(true);
  });

  it("ranking mostra o top da semana e as 5 ligas", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await ctx.db.walletLedger.create({
      data: {
        playerId: g.playerId,
        currency: "COINS",
        delta: 700n,
        balanceAfter: 700n,
        reason: "production_collect",
        createdAt: ctx.clock.now,
      },
    });
    const r = (await admin("GET", "/ranking")).json();
    expect(r.top[0]).toMatchObject({ playerId: g.playerId, score: "700", rank: 1 });
    expect(r.leagues.map((l: { name: string }) => l.name)).toEqual([
      "Bronze",
      "Prata",
      "Ouro",
      "Platina",
      "Diamante",
    ]);
  });

  it("moderação: lista denúncias, troca o nome pelo padrão e arquiva", async () => {
    ctx = await createTestContext();
    const target = await newGuest(ctx.app);
    await post(ctx.app, target, "/player/name", { displayName: "Nome Ruim" }, key());
    const other = await newGuest(ctx.app);
    await post(ctx.app, other, "/players/report", { playerId: target.playerId });
    const list = (await admin("GET", "/reports")).json();
    expect(list.open[0]).toMatchObject({
      playerId: target.playerId,
      displayName: "Nome Ruim",
      customName: true,
      reports: 1,
    });
    const reset = await admin("POST", `/reports/${target.playerId}/reset-name`);
    expect(reset.json().displayName).toMatch(/^Empreendedor \d{4}$/);
    expect((await admin("GET", "/reports")).json()).toMatchObject({ open: [], resolved: 1 });

    // Arquivar sem trocar o nome.
    const third = await newGuest(ctx.app);
    await post(ctx.app, third, "/players/report", { playerId: other.playerId });
    expect((await admin("POST", `/reports/${other.playerId}/dismiss`)).json().dismissed).toBe(1);
    const detail = (await admin("GET", `/players/${target.playerId}`)).json();
    expect(detail).toMatchObject({ nameChanged: true, openReports: 0, prestige: { stars: 0 } });
    expect(detail.code).toBe(target.playerId.slice(0, 8).toUpperCase());
  });
});
