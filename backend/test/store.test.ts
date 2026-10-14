import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  coinsOf,
  createTestContext,
  get,
  key,
  newGuest,
  post,
  setCoins,
  type Guest,
  type TestContext,
} from "./helpers.js";

let ctx: TestContext;

afterEach(async () => {
  await ctx?.close();
});

const gemsOf = async (playerId: string) =>
  (await ctx.db.playerWallet.findUniqueOrThrow({ where: { playerId } })).gems;
const setGems = (playerId: string, gems: bigint) =>
  ctx.db.playerWallet.update({ where: { playerId }, data: { gems } });
const state = async (g: Guest) => (await get(ctx.app, g, "/player/state")).json();
const buyMock = (g: Guest, productId: string, token = `mock-${key()}`) =>
  post(ctx.app, g, "/purchases/verify", { store: "mock", productId, purchaseToken: token });

const GEMS_50 = "br.com.imperiodebolso.gems_50";
const VIP = "br.com.imperiodebolso.vip_monthly";

describe("loja (modo de teste)", () => {
  it("catálogo indica sandbox e traz preços da doc", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    const cat = (await get(ctx.app, g, "/store/catalog")).json();
    expect(cat.sandbox).toBe(true);
    expect(cat.items.find((i: { id: string }) => i.id === "vip_monthly")).toMatchObject({
      priceBRL: "14,90",
    });
    expect(cat.items.find((i: { id: string }) => i.id === "gems_50")).toMatchObject({ gems: "50" });
  });

  it("auto-coleta com diamantes soma tempo à validade e liga o direito", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    const broke = await post(ctx.app, g, "/store/buy", { itemId: "auto_collect_24h" });
    expect(broke.json().error.code).toBe("INSUFFICIENT_FUNDS");
    await setGems(g.playerId, 100n);
    const first = await post(ctx.app, g, "/store/buy", { itemId: "auto_collect_24h" });
    expect(first.json().autoCollectUntil).toBe("2026-01-02T12:00:00.000Z");
    const second = await post(ctx.app, g, "/store/buy", { itemId: "auto_collect_24h" });
    expect(second.json().autoCollectUntil).toBe("2026-01-03T12:00:00.000Z");
    expect(await gemsOf(g.playerId)).toBe(60n);
    expect((await state(g)).player).toMatchObject({ autoCollect: true });
    ctx.clock.advance(3 * 24 * 3600);
    expect((await state(g)).player.autoCollect).toBe(false);
  });

  it("turbo gera na hora as horas de produção do mapa", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await setGems(g.playerId, 100n);
    const none = await post(ctx.app, g, "/store/buy", { itemId: "boost_1h", district: "praia" });
    expect(none.json().error.code).toBe("NOTHING_TO_BOOST");
    expect(await gemsOf(g.playerId)).toBe(100n); // nada cobrado quando falha
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    const res = await post(ctx.app, g, "/store/buy", { itemId: "boost_1h", district: "praia" });
    expect(res.json()).toMatchObject({ coins: "3600" }); // 360 ciclos × 10
    expect(await coinsOf(ctx.db, g.playerId)).toBe(3600n);
    expect(await gemsOf(g.playerId)).toBe(90n);
  });
});

describe("compras com dinheiro (sandbox)", () => {
  it("diamantes: concede uma vez por transação; recibo de outra conta é recusado", async () => {
    ctx = await createTestContext();
    const a = await newGuest(ctx.app);
    const b = await newGuest(ctx.app);
    const token = "mock-compra-1";
    const res = await buyMock(a, GEMS_50, token);
    expect(res.statusCode).toBe(201);
    expect(await gemsOf(a.playerId)).toBe(50n);
    const again = await buyMock(a, GEMS_50, token);
    expect(again.json().duplicate).toBe(true);
    expect(await gemsOf(a.playerId)).toBe(50n);
    const stolen = await buyMock(b, GEMS_50, token);
    expect(stolen.json().error.code).toBe("PURCHASE_OWNED_BY_OTHER");
  });

  it("recibo inválido, produto inexistente e lojas reais ainda não configuradas", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    expect((await buyMock(g, GEMS_50, "falso")).json().error.code).toBe("PURCHASE_INVALID");
    expect((await buyMock(g, "br.com.imperiodebolso.nada")).json().error.code).toBe(
      "PRODUCT_NOT_FOUND",
    );
    const google = await post(ctx.app, g, "/purchases/verify", {
      store: "google",
      productId: GEMS_50,
      purchaseToken: "token-real",
    });
    expect(google.statusCode).toBe(501);
    expect(google.json().error.code).toBe("STORE_NOT_CONFIGURED");
  });

  it("Passe VIP: 30 dias, liga a auto-coleta e renova a partir do vencimento", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await buyMock(g, VIP);
    expect((await state(g)).player).toMatchObject({
      autoCollect: true,
      vipUntil: "2026-01-31T12:00:00.000Z",
    });
    await buyMock(g, VIP);
    expect((await state(g)).player.vipUntil).toBe("2026-03-02T12:00:00.000Z");
    const restore = (await post(ctx.app, g, "/purchases/restore", {}, null)).json();
    expect(restore.purchases).toHaveLength(2);
    expect(restore.activeSubscriptions).toHaveLength(2);
  });

  it("reembolso revoga: diamantes já gastos não ficam negativos e a falta é registrada", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    const token = "mock-reembolso";
    await buyMock(g, GEMS_50, token);
    await post(ctx.app, g, "/store/buy", { itemId: "auto_collect_24h" }); // gasta 20
    const refund = await post(ctx.app, g, "/purchases/mock/refund", { transactionId: token }, null);
    expect(refund.json()).toMatchObject({ alreadyRevoked: false, shortfall: "20" });
    expect(await gemsOf(g.playerId)).toBe(0n);
    const twice = await post(ctx.app, g, "/purchases/mock/refund", { transactionId: token }, null);
    expect(twice.json().alreadyRevoked).toBe(true);
  });

  it("reembolso do VIP desliga a auto-coleta na hora", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await buyMock(g, VIP, "mock-vip");
    await post(ctx.app, g, "/purchases/mock/refund", { transactionId: "mock-vip" }, null);
    expect((await state(g)).player).toMatchObject({ autoCollect: false, vipUntil: null });
  });

  it("fora do modo de teste, compra e reembolso simulados não existem", async () => {
    ctx = await createTestContext({ STORE_MODE: "live" });
    const g = await newGuest(ctx.app);
    expect((await buyMock(g, GEMS_50)).json().error.code).toBe("MOCK_DISABLED");
    const refund = await post(ctx.app, g, "/purchases/mock/refund", { transactionId: "x" }, null);
    expect(refund.statusCode).toBe(404);
  });
});

describe("anúncios recompensados (modo de teste)", () => {
  async function watch(g: Guest, placement: string, district?: string) {
    const start = await post(ctx.app, g, "/ads/start", {
      placement,
      ...(district ? { district } : {}),
    });
    if (start.statusCode !== 201) return { start };
    const id = start.json().sessionId;
    const early = await post(ctx.app, g, "/ads/claim", { sessionId: id });
    await post(ctx.app, g, "/ads/mock-complete", { sessionId: id }, null);
    const claim = await post(ctx.app, g, "/ads/claim", { sessionId: id });
    return { start, early, claim, id };
  }

  it("+15 min de produção: só paga depois de confirmado, uma vez, com limite diário", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    const r = await watch(g, "ad_boost", "praia");
    expect(r.start.json().rewardCoins).toBe("900"); // 90 ciclos × 10
    expect(r.early!.json().error.code).toBe("AD_NOT_VERIFIED");
    expect(r.claim!.json().coins).toBe("900");
    const again = await post(ctx.app, g, "/ads/claim", { sessionId: r.id });
    expect(again.json().error.code).toBe("AD_ALREADY_CLAIMED");
    for (let i = 0; i < 4; i++) await watch(g, "ad_boost", "praia");
    const sixth = await post(ctx.app, g, "/ads/start", {
      placement: "ad_boost",
      district: "praia",
    });
    expect(sixth.json().error.code).toBe("AD_DAILY_LIMIT");
    expect(await coinsOf(ctx.db, g.playerId)).toBe(5n * 900n);
  });

  it("dobrar ganhos offline: paga o AFK de novo uma única vez, logo após o resumo", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await setCoins(ctx.db, g.playerId, 1_000n);
    await post(ctx.app, g, "/presence", { district: "praia" });
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await post(ctx.app, g, "/managers/hire", { businessSlug: "agua" });
    expect(
      (await post(ctx.app, g, "/ads/start", { placement: "offline_double" })).json().error.code,
    ).toBe("AD_NOT_AVAILABLE");
    await post(ctx.app, g, "/presence", { district: "cidade" });
    ctx.clock.advance(100);
    const back = await post(ctx.app, g, "/presence", { district: "praia" });
    expect(back.json().total).toBe("120"); // 100 s × 1,25 (ajudante) → 12 ciclos
    const before = await coinsOf(ctx.db, g.playerId);
    const r = await watch(g, "offline_double");
    expect(r.claim!.json().coins).toBe("120");
    expect(await coinsOf(ctx.db, g.playerId)).toBe(before + 120n);
    const twice = await post(ctx.app, g, "/ads/start", { placement: "offline_double" });
    expect(twice.json().error.code).toBe("AD_NOT_AVAILABLE");
  });

  it("janela do 'dobrar' expira 15 min após o resumo", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await setCoins(ctx.db, g.playerId, 1_000n);
    await post(ctx.app, g, "/presence", { district: "praia" });
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await post(ctx.app, g, "/managers/hire", { businessSlug: "agua" });
    await post(ctx.app, g, "/presence", { district: "cidade" });
    ctx.clock.advance(100);
    await post(ctx.app, g, "/presence", { district: "praia" });
    ctx.clock.advance(16 * 60);
    const late = await post(ctx.app, g, "/ads/start", { placement: "offline_double" });
    expect(late.json().error.code).toBe("AD_NOT_AVAILABLE");
  });
});

describe("SSV do AdMob (produção)", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const keys = async (id: string) => (id === "42" ? pem : undefined);

  function signedQuery(customData: string, transactionId: string) {
    const msg =
      `ad_network=5450213213286189855&ad_unit=1234567890&custom_data=${customData}` +
      `&reward_amount=1&reward_item=bonus&timestamp=1767268800000&transaction_id=${transactionId}&user_id=u1`;
    const sig = sign("sha256", Buffer.from(msg), { key: privateKey, dsaEncoding: "der" }).toString(
      "base64url",
    );
    return `${msg}&signature=${sig}&key_id=42`;
  }

  it("assinatura válida confirma a sessão; adulterada é recusada; mock não existe", async () => {
    ctx = await createTestContext({ ADS_MODE: "admob" }, keys);
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    const start = await post(ctx.app, g, "/ads/start", {
      placement: "ad_boost",
      district: "praia",
    });
    const id = start.json().sessionId;

    const mock = await post(ctx.app, g, "/ads/mock-complete", { sessionId: id }, null);
    expect(mock.statusCode).toBe(404);

    const forged = signedQuery(id, "tx-1").replace("reward_amount=1", "reward_amount=999");
    expect(
      (await ctx.app.inject({ method: "GET", url: `/api/v1/ads/ssv?${forged}` })).statusCode,
    ).toBe(400);

    const valid = signedQuery(id, "tx-1");
    const ok = await ctx.app.inject({ method: "GET", url: `/api/v1/ads/ssv?${valid}` });
    expect(ok.json()).toEqual({ verified: true });
    const replay = await ctx.app.inject({ method: "GET", url: `/api/v1/ads/ssv?${valid}` });
    expect(replay.json()).toEqual({ verified: true });

    const claim = await post(ctx.app, g, "/ads/claim", { sessionId: id });
    expect(claim.json().coins).toBe("900");
  });
});

describe("versão sem dinheiro real e sem anúncios (ADR 0018)", () => {
  it("itens em R$ e anúncios somem do catálogo e as rotas recusam", async () => {
    ctx = await createTestContext({ PURCHASES_ENABLED: "false", ADS_ENABLED: "false" });
    const g = await newGuest(ctx.app);
    const cat = (await get(ctx.app, g, "/store/catalog")).json();
    expect(cat).toMatchObject({ purchasesEnabled: false, adsEnabled: false, sandbox: false });
    const kinds = new Set(cat.items.map((i: { kind: string }) => i.kind));
    expect([...kinds].sort()).toEqual(["auto_collect", "boost", "turbo"]);
    const buy = await post(ctx.app, g, "/purchases/verify", {
      store: "mock",
      productId: "br.com.imperiodebolso.gems_50",
      purchaseToken: "mock-abc",
    });
    expect(buy.json().error.code).toBe("PURCHASES_DISABLED");
    const ad = await post(ctx.app, g, "/ads/start", { placement: "ad_boost" });
    expect(ad.json().error.code).toBe("ADS_DISABLED");
    const missions = (await get(ctx.app, g, "/missions")).json().missions;
    expect(missions.map((m: { template: string }) => m.template)).not.toContain("watch_ads");
  });
});
