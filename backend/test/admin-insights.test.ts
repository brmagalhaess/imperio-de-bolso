import { afterEach, describe, expect, it } from "vitest";
import { ADMIN_TOKEN, createTestContext, newGuest, post, type TestContext } from "./helpers.js";

// Painel admin v3 (ADR 0030): tendências, receita e ações de suporte.

let ctx: TestContext;
const auth = { authorization: `Bearer ${ADMIN_TOKEN}` };
const P = "br.com.imperiodebolso";

afterEach(async () => {
  await ctx?.close();
});

const receipt = (playerId: string, productId: string, store: string, tx: string) =>
  ctx.db.purchaseReceipt.create({
    data: {
      playerId,
      store,
      transactionId: tx,
      productId,
      status: "VERIFIED",
      gemsGranted: 50n,
      createdAt: ctx.clock.now,
    },
  });

describe("painel admin v3", () => {
  it("tendências por dia: novos, ativos, compras e receita", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    // O banco grava createdAt com o relógio real; o painel usa o relógio do servidor (teste).
    await ctx.db.player.update({ where: { id: g.playerId }, data: { createdAt: ctx.clock.now } });
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await receipt(g.playerId, `${P}.gems_50`, "apple", "t1");
    await receipt(g.playerId, `${P}.gems_50`, "mock", "t2"); // teste: fora da receita
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/admin/trends?days=7",
      headers: auth,
    });
    const days = res.json().days;
    expect(days).toHaveLength(7);
    const today = days[days.length - 1];
    expect(today).toMatchObject({ newPlayers: 1, activePlayers: 1, purchases: 1, revenueBRL: 4.9 });
  });

  it("receita por loja e por produto, compras recentes e reembolso manual", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await ctx.db.playerWallet.update({ where: { playerId: g.playerId }, data: { gems: 50n } });
    await receipt(g.playerId, `${P}.gems_50`, "google", "GPA.1");
    await receipt(g.playerId, `${P}.gems_50`, "apple", "200001");
    let r = (
      await ctx.app.inject({ method: "GET", url: "/api/admin/revenue", headers: auth })
    ).json();
    expect(r.totals).toMatchObject({ revenueBRL: 9.8, purchases: 2, refunds: 0, buyers: 1 });
    expect(r.byStore).toEqual([
      { store: "apple", purchases: 1, revenueBRL: 4.9 },
      { store: "google", purchases: 1, revenueBRL: 4.9 },
    ]);
    expect(r.recent[0]).toMatchObject({ title: expect.any(String), store: expect.any(String) });

    const revoke = await ctx.app.inject({
      method: "POST",
      url: "/api/admin/purchases/revoke",
      headers: auth,
      payload: { store: "google", transactionId: "GPA.1" },
    });
    expect(revoke.json()).toMatchObject({ alreadyRevoked: false });
    r = (await ctx.app.inject({ method: "GET", url: "/api/admin/revenue", headers: auth })).json();
    expect(r.totals).toMatchObject({ purchases: 1, refunds: 1 });
    const mine = (
      await ctx.app.inject({
        method: "GET",
        url: `/api/admin/players/${g.playerId}/purchases`,
        headers: auth,
      })
    ).json();
    expect(mine.purchases.map((p: { status: string }) => p.status).sort()).toEqual([
      "REVOKED",
      "VERIFIED",
    ]);
  });

  it("diamantes de compensação: entra no ledger e repetir a chave não dá de novo", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    const give = () =>
      ctx.app.inject({
        method: "POST",
        url: `/api/admin/players/${g.playerId}/gems`,
        headers: { ...auth, "idempotency-key": "suporte-ticket-123" },
        payload: { amount: 30, note: "compra não entregue" },
      });
    expect((await give()).json()).toEqual({ playerId: g.playerId, gems: "30" });
    expect((await give()).json()).toEqual({ playerId: g.playerId, gems: "30" });
    const w = await ctx.db.playerWallet.findUniqueOrThrow({ where: { playerId: g.playerId } });
    expect(w.gems).toBe(30n);
    const bad = await ctx.app.inject({
      method: "POST",
      url: `/api/admin/players/${g.playerId}/gems`,
      headers: { ...auth, "idempotency-key": "outra-chave-1" },
      payload: { amount: 0, note: "x" },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("jogadores por plataforma: registra o aparelho e a versão ao abrir o jogo", async () => {
    ctx = await createTestContext();
    const a = await newGuest(ctx.app);
    const b = await newGuest(ctx.app);
    await newGuest(ctx.app); // nunca abriu a loja: plataforma desconhecida
    const open = (g: typeof a, platform: string, version?: string) =>
      ctx.app.inject({
        method: "GET",
        url: `/api/v1/store/catalog?platform=${platform}`,
        headers: {
          authorization: `Bearer ${g.token}`,
          ...(version ? { "x-app-version": version } : {}),
        },
      });
    await open(a, "ios", "1.0.5");
    await open(b, "android");
    await open(b, "android", "1.0.5"); // atualizou o app
    const r = (
      await ctx.app.inject({ method: "GET", url: "/api/admin/platforms", headers: auth })
    ).json();
    const by = Object.fromEntries(r.platforms.map((p: { platform: string }) => [p.platform, p]));
    expect(by.ios).toMatchObject({ players: 1, versions: [{ version: "1.0.5", players: 1 }] });
    expect(by.android).toMatchObject({ players: 1, versions: [{ version: "1.0.5", players: 1 }] });
    expect(by.desconhecida.players).toBe(1);
    const list = (
      await ctx.app.inject({ method: "GET", url: "/api/admin/players", headers: auth })
    ).json();
    expect(list.players.map((p: { platform: string | null }) => p.platform).sort()).toEqual([
      "android",
      "ios",
      null,
    ]);
  });

  it("compras de teste (Sandbox, testadores, equipe) ficam no registro mas fora da receita", async () => {
    ctx = await createTestContext();
    const real = await newGuest(ctx.app);
    const staff = await newGuest(ctx.app);
    await ctx.db.player.update({ where: { id: staff.playerId }, data: { staff: true } });
    await receipt(real.playerId, `${P}.gems_50`, "apple", "real-1");
    await ctx.db.purchaseReceipt.create({
      data: {
        playerId: real.playerId,
        store: "apple",
        transactionId: "sandbox-1",
        productId: `${P}.gems_300`,
        status: "VERIFIED",
        test: true,
        createdAt: ctx.clock.now,
      },
    });
    await receipt(staff.playerId, `${P}.bundle_lenda`, "apple", "equipe-1");
    const r = (
      await ctx.app.inject({ method: "GET", url: "/api/admin/revenue", headers: auth })
    ).json();
    expect(r.totals).toMatchObject({ revenueBRL: 4.9, purchases: 1, testPurchases: 1, buyers: 1 });
    expect(r.byProduct.map((p: { productId: string }) => p.productId)).toEqual([`${P}.gems_50`]);
    // Conta da equipe não aparece nem na lista; o Sandbox de quem não é da equipe aparece marcado.
    expect(r.recent).toHaveLength(2);
    expect(r.recent.filter((x: { test: boolean }) => x.test)).toHaveLength(1);
    const players = (
      await ctx.app.inject({ method: "GET", url: "/api/admin/players", headers: auth })
    ).json().players;
    expect(players.map((p: { id: string }) => p.id)).toEqual([real.playerId]);
    const team = (
      await ctx.app.inject({ method: "GET", url: "/api/admin/players?staff=1", headers: auth })
    ).json().players;
    expect(team.map((p: { id: string }) => p.id)).toEqual([staff.playerId]);
    const overview = (
      await ctx.app.inject({ method: "GET", url: "/api/admin/overview", headers: auth })
    ).json();
    expect(overview.players).toBe(1);
    const trends = (
      await ctx.app.inject({ method: "GET", url: "/api/admin/trends?days=7", headers: auth })
    ).json();
    expect(trends.days.at(-1)).toMatchObject({ purchases: 1, revenueBRL: 4.9 });
  });

  it("versão publicada em cada loja e versões em uso pelos jogadores", async () => {
    const appleFetch = (async () =>
      new Response(
        JSON.stringify({
          results: [{ version: "1.0.3", currentVersionReleaseDate: "2026-10-19T16:33:51Z" }],
        }),
      )) as typeof fetch;
    const play = {
      product: async () => null,
      subscription: async () => null,
      tracks: async () => [
        { track: "production", name: "1.0.5 (5)", status: "completed", versionCodes: ["5"] },
        { track: "internal", name: "1.0.6 (6)", status: "completed", versionCodes: ["6"] },
      ],
    };
    ctx = await createTestContext({}, undefined, undefined, undefined, play, appleFetch);
    const g = await newGuest(ctx.app);
    await ctx.db.player.update({
      where: { id: g.playerId },
      data: { platform: "android", appVersion: "1.0.5", lastSeenAt: ctx.clock.now },
    });
    const r = (
      await ctx.app.inject({ method: "GET", url: "/api/admin/stores", headers: auth })
    ).json();
    expect(r.apple).toMatchObject({ version: "1.0.3", releasedAt: "2026-10-19T16:33:51Z" });
    expect(r.google).toMatchObject({
      version: "1.0.5",
      code: "5",
      status: "completed",
      rollout: 1,
      testing: { version: "1.0.6" },
      inUse: [{ version: "1.0.5", players: 1 }],
    });
  });
});
