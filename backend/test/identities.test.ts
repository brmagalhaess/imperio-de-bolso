import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, get, newGuest, post, type TestContext } from "./helpers.js";

// Contas vinculadas (ADR 0015): Google/Apple com chaves geradas aqui (nada sai para a internet).

let ctx: TestContext;

afterEach(async () => {
  await ctx?.close();
});

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1" };
const keys = async (_p: string, kid: string) => (kid === "k1" ? jwk : undefined);
const GOOGLE_ID = "123-test.apps.googleusercontent.com";

function token(sub: string, opts: { aud?: string; iss?: string; exp?: number } = {}) {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg: "RS256", kid: "k1", typ: "JWT" });
  const body = enc({
    iss: opts.iss ?? "https://accounts.google.com",
    aud: opts.aud ?? GOOGLE_ID,
    sub,
    exp: opts.exp ?? Math.floor(new Date("2026-01-01T13:00:00Z").getTime() / 1000),
  });
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), privateKey).toString("base64url");
  return `${head}.${body}.${sig}`;
}

const anon = (app: TestContext["app"], url: string, payload: object) =>
  app.inject({ method: "POST", url: `/api/v1${url}`, payload });

describe("vincular conta Google/Apple", () => {
  it("sem configuração o vínculo fica desligado (503)", async () => {
    ctx = await createTestContext({}, undefined, keys);
    const g = await newGuest(ctx.app);
    const res = await post(
      ctx.app,
      g,
      "/auth/link",
      { provider: "google", idToken: token("u1") },
      null,
    );
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe("LINK_NOT_CONFIGURED");
  });

  it("vincula, recupera em outro aparelho e o aparelho antigo perde a sessão de convidado", async () => {
    ctx = await createTestContext({ GOOGLE_CLIENT_IDS: GOOGLE_ID }, undefined, keys);
    const g = await newGuest(ctx.app);
    const ids = await get(ctx.app, g, "/auth/identities");
    expect(ids.json()).toEqual({ linked: [], available: ["google"] });

    const link = await post(
      ctx.app,
      g,
      "/auth/link",
      { provider: "google", idToken: token("u1") },
      null,
    );
    expect(link.statusCode).toBe(200);
    expect(link.json().linked).toEqual(["google"]);

    const other = await newGuest(ctx.app);
    const taken = await post(
      ctx.app,
      other,
      "/auth/link",
      { provider: "google", idToken: token("u1") },
      null,
    );
    expect(taken.json().error.code).toBe("IDENTITY_IN_USE");

    const signIn = await anon(ctx.app, "/auth/social", {
      provider: "google",
      idToken: token("u1"),
    });
    expect(signIn.statusCode).toBe(200);
    expect(signIn.json()).toMatchObject({ playerId: g.playerId, guestId: g.guestId });
    // O segredo antigo deixou de valer; o novo entra.
    const old = await anon(ctx.app, "/auth/guest", {
      guestId: g.guestId,
      guestSecret: g.guestSecret,
    });
    expect(old.statusCode).toBe(401);
    const fresh = await anon(ctx.app, "/auth/guest", {
      guestId: g.guestId,
      guestSecret: signIn.json().guestSecret,
    });
    expect(fresh.statusCode).toBe(200);
  });

  it("recusa token de outro app, de outro emissor, vencido ou adulterado", async () => {
    ctx = await createTestContext({ GOOGLE_CLIENT_IDS: GOOGLE_ID }, undefined, keys);
    const g = await newGuest(ctx.app);
    for (const bad of [
      token("u1", { aud: "outro-app" }),
      token("u1", { iss: "https://evil.example" }),
      token("u1", { exp: 1 }),
      token("u1").slice(0, -4) + "AAAA",
    ]) {
      const res = await post(ctx.app, g, "/auth/link", { provider: "google", idToken: bad }, null);
      expect(res.json().error.code).toBe("INVALID_ID_TOKEN");
    }
    const none = await anon(ctx.app, "/auth/social", {
      provider: "google",
      idToken: token("ninguem"),
    });
    expect(none.json().error.code).toBe("IDENTITY_NOT_FOUND");
  });
});
