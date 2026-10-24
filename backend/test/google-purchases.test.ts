import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  googlePlayApi,
  parseServiceAccount,
  type GoogleProductPurchase,
  type GoogleSubscriptionPurchase,
  type GooglePlayApi,
} from "../src/lib/google-play.js";
import { createTestContext, get, newGuest, post, type TestContext } from "./helpers.js";

// Google Play Billing: o servidor confere o purchaseToken na API do Google Play (aqui, falsa).

const P = "br.com.imperiodebolso";
let ctx: TestContext;

afterEach(async () => {
  await ctx?.close();
});

/** API do Google Play falsa: tokens cadastrados no teste. */
function fakePlay() {
  const products = new Map<string, GoogleProductPurchase>();
  const subs = new Map<string, GoogleSubscriptionPurchase>();
  const api: GooglePlayApi = {
    async product(productId, token) {
      const p = products.get(token);
      return p ? { productId, ...p } : null;
    },
    async subscription(token) {
      return subs.get(token) ?? null;
    },
  };
  return { api, products, subs };
}

const gemsOf = async (playerId: string) =>
  (await ctx.db.playerWallet.findUniqueOrThrow({ where: { playerId } })).gems;

const verify = (g: Awaited<ReturnType<typeof newGuest>>, productId: string, token: string) =>
  post(ctx.app, g, "/purchases/verify", { store: "google", productId, purchaseToken: token });

describe("compras do Google Play", () => {
  it("diamantes: entrega uma vez; pendente e cancelada não entregam", async () => {
    const play = fakePlay();
    ctx = await createTestContext({}, undefined, undefined, undefined, play.api);
    const g = await newGuest(ctx.app);
    play.products.set("tok-ok", { purchaseState: 0, orderId: "GPA.1111-2222-3333-44444" });
    play.products.set("tok-pend", { purchaseState: 2 });
    play.products.set("tok-cancel", { purchaseState: 1, orderId: "GPA.9" });

    const ok = await verify(g, `${P}.gems_50`, "tok-ok");
    expect(ok.statusCode).toBe(201);
    expect(await gemsOf(g.playerId)).toBe(50n);
    // O jogo reenviou o mesmo token (app fechou antes de consumir): não entrega de novo.
    const again = await verify(g, `${P}.gems_50`, "tok-ok");
    expect(again.json()).toMatchObject({ duplicate: true });
    expect(await gemsOf(g.playerId)).toBe(50n);

    expect((await verify(g, `${P}.gems_50`, "tok-pend")).json().error.code).toBe(
      "PURCHASE_PENDING",
    );
    expect((await verify(g, `${P}.gems_50`, "tok-cancel")).json().error.code).toBe(
      "PURCHASE_REVOKED",
    );
    expect((await verify(g, `${P}.gems_50`, "tok-desconhecido")).json().error.code).toBe(
      "PURCHASE_INVALID",
    );
    // Outra conta não pode usar o recibo de quem pagou.
    const other = await newGuest(ctx.app);
    expect((await verify(other, `${P}.gems_50`, "tok-ok")).json().error.code).toBe(
      "PURCHASE_OWNED_BY_OTHER",
    );
  });

  it("Passe VIP: vale até o fim do período do Google; renovação (novo pedido) estende", async () => {
    const play = fakePlay();
    ctx = await createTestContext({}, undefined, undefined, undefined, play.api);
    const g = await newGuest(ctx.app);
    const month1 = "2026-02-01T12:00:00.000Z";
    play.subs.set("sub-tok", {
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      latestOrderId: "GPA.5555-6666-7777-88888",
      lineItems: [{ productId: `${P}.vip_monthly`, expiryTime: month1 }],
    });
    expect((await verify(g, `${P}.vip_monthly`, "sub-tok")).statusCode).toBe(201);
    let cat = (await get(ctx.app, g, "/store/catalog")).json();
    expect(cat.entitlements.vipUntil).toBe(month1);

    // Renovou: mesmo token, pedido novo "..0".
    const month2 = "2026-03-01T12:00:00.000Z";
    play.subs.set("sub-tok", {
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      latestOrderId: "GPA.5555-6666-7777-88888..0",
      lineItems: [{ productId: `${P}.vip_monthly`, expiryTime: month2 }],
    });
    expect((await verify(g, `${P}.vip_monthly`, "sub-tok")).statusCode).toBe(201);
    cat = (await get(ctx.app, g, "/store/catalog")).json();
    expect(cat.entitlements.vipUntil).toBe(month2);

    // Vencida: não entrega.
    play.subs.set("sub-velha", {
      subscriptionState: "SUBSCRIPTION_STATE_EXPIRED",
      latestOrderId: "GPA.1",
      lineItems: [{ productId: `${P}.vip_monthly`, expiryTime: "2025-12-01T00:00:00.000Z" }],
    });
    expect((await verify(g, `${P}.vip_monthly`, "sub-velha")).json().error.code).toBe(
      "PURCHASE_EXPIRED",
    );
  });

  it("sem conta de serviço no servidor, a loja do Google responde 501", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    const res = await verify(g, `${P}.gems_50`, "tok");
    expect(res.statusCode).toBe(501);
    expect(res.json().error.code).toBe("STORE_NOT_CONFIGURED");
  });

  it("API real: assina o JWT da conta de serviço e consulta a compra", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const sa = parseServiceAccount(
      Buffer.from(
        JSON.stringify({
          client_email: "verificador@exemplo.iam.gserviceaccount.com",
          private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
        }),
      ).toString("base64"),
    )!;
    const calls: string[] = [];
    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push(String(url));
      if (String(url).includes("oauth2")) {
        const assertion = new URLSearchParams(String(init?.body)).get("assertion")!;
        expect(assertion.split(".")).toHaveLength(3);
        return new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }));
      }
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer at");
      if (String(url).endsWith("/tokens/nao-existe")) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify({ purchaseState: 0, orderId: "GPA.1" }));
    }) as typeof fetch;
    const api = googlePlayApi("br.com.imperiodebolso.game", sa, fakeFetch);
    expect(await api.product(`${P}.gems_50`, "abc")).toMatchObject({ orderId: "GPA.1" });
    expect(await api.product(`${P}.gems_50`, "nao-existe")).toBeNull();
    expect(calls.filter((c) => c.includes("oauth2"))).toHaveLength(1); // token reaproveitado
    expect(calls[1]).toBe(
      "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/br.com.imperiodebolso.game/purchases/products/br.com.imperiodebolso.gems_50/tokens/abc",
    );
  });
});
