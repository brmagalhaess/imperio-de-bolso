import { execFileSync } from "node:child_process";
import { createPrivateKey, sign, X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { verifyAppleJws } from "../src/lib/apple-jws.js";
import { createTestContext, get, newGuest, post, type TestContext } from "./helpers.js";

// Compras da App Store (StoreKit 2, ADR 0022). Os testes montam uma cadeia própria (raiz →
// intermediária WWDR → folha) com os mesmos OIDs da Apple e assinam JWS como a App Store.

let ctx: TestContext;
let chain: { x5c: string[]; leafKey: string; rootFp: string; otherX5c: string[] };
const BUNDLE = "br.com.imperiodebolso.game";

function buildChain(dir: string, tag: string) {
  const run = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
  writeFileSync(
    join(dir, "ext.cnf"),
    `[req]\ndistinguished_name=dn\n[dn]\n[root]\nbasicConstraints=critical,CA:TRUE\n[int]\nbasicConstraints=critical,CA:TRUE\n1.2.840.113635.100.6.2.1=ASN1:NULL\n[leaf]\nbasicConstraints=CA:FALSE\n1.2.840.113635.100.6.11.1=ASN1:NULL\n`,
  );
  for (const n of ["root", "int", "leaf"]) {
    run("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", `${tag}${n}.key`);
  }
  run(
    "req",
    "-new",
    "-x509",
    "-key",
    `${tag}root.key`,
    "-subj",
    `/CN=${tag} Root`,
    "-days",
    "30",
    "-config",
    "ext.cnf",
    "-extensions",
    "root",
    "-out",
    `${tag}root.pem`,
  );
  for (const [n, ca, ext] of [
    ["int", "root", "int"],
    ["leaf", "int", "leaf"],
  ] as const) {
    run(
      "req",
      "-new",
      "-key",
      `${tag}${n}.key`,
      "-subj",
      `/CN=${tag} ${n}`,
      "-out",
      `${tag}${n}.csr`,
    );
    run(
      "x509",
      "-req",
      "-in",
      `${tag}${n}.csr`,
      "-CA",
      `${tag}${ca}.pem`,
      "-CAkey",
      `${tag}${ca}.key`,
      "-CAcreateserial",
      "-days",
      "30",
      "-extfile",
      "ext.cnf",
      "-extensions",
      ext,
      "-out",
      `${tag}${n}.pem`,
    );
  }
  const der = (n: string) =>
    new X509Certificate(readFileSync(join(dir, `${tag}${n}.pem`))).raw.toString("base64");
  return {
    x5c: ["leaf", "int", "root"].map(der),
    leafKey: readFileSync(join(dir, `${tag}leaf.key`), "utf8"),
    rootFp: new X509Certificate(readFileSync(join(dir, `${tag}root.pem`))).fingerprint256,
  };
}

function jws(payload: Record<string, unknown>, x5c = chain.x5c, key = chain.leafKey) {
  const h = Buffer.from(JSON.stringify({ alg: "ES256", x5c })).toString("base64url");
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign("sha256", Buffer.from(`${h}.${p}`), {
    key: createPrivateKey(key),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `${h}.${p}.${sig}`;
}

const tx = (over: Record<string, unknown> = {}) => ({
  transactionId: "2000000111",
  originalTransactionId: "2000000111",
  bundleId: BUNDLE,
  productId: "br.com.imperiodebolso.gems_50",
  environment: "Sandbox",
  type: "Consumable",
  ...over,
});

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "apple-jws-"));
  const a = buildChain(dir, "a");
  const b = buildChain(dir, "b");
  chain = { x5c: a.x5c, leafKey: a.leafKey, rootFp: a.rootFp, otherX5c: b.x5c };
});

afterEach(async () => {
  await ctx?.close();
});

async function iosContext() {
  ctx = await createTestContext(
    { PURCHASES_ENABLED: "false", PURCHASES_PLATFORMS: "ios", STORE_MODE: "live" },
    undefined,
    undefined,
    chain.rootFp,
  );
  ctx.clock.now = new Date(); // a cadeia de teste vale a partir de hoje
  return newGuest(ctx.app);
}

describe("JWS da App Store", () => {
  it("aceita a cadeia confiável e recusa raiz, assinatura ou cadeia trocadas", () => {
    const now = new Date();
    expect(verifyAppleJws(jws(tx()), { now, rootFingerprint: chain.rootFp })).toMatchObject({
      productId: "br.com.imperiodebolso.gems_50",
    });
    // Sem fixar a raiz de teste, só a Apple Root CA - G3 vale.
    expect(() => verifyAppleJws(jws(tx()), { now })).toThrow(/Apple Root CA/);
    // Payload alterado depois de assinado.
    const [h, , s] = jws(tx()).split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify(tx({ productId: "x" }))).toString("base64url")}.${s}`;
    expect(() => verifyAppleJws(forged, { now, rootFingerprint: chain.rootFp })).toThrow(
      /assinatura/,
    );
    // Folha de outra cadeia com a raiz confiável no fim.
    const mixed = [chain.otherX5c[0]!, chain.x5c[1]!, chain.x5c[2]!];
    expect(() => verifyAppleJws(jws(tx(), mixed), { now, rootFingerprint: chain.rootFp })).toThrow(
      /cadeia/,
    );
  });
});

describe("compras no iPhone (PURCHASES_PLATFORMS=ios)", () => {
  it("catálogo mostra os itens pagos só no iOS e a compra da Apple credita os diamantes uma vez", async () => {
    const g = await iosContext();
    const ios = (await get(ctx.app, g, "/store/catalog?platform=ios")).json();
    const android = (await get(ctx.app, g, "/store/catalog?platform=android")).json();
    expect(ios.purchasesEnabled).toBe(true);
    expect(ios.items.some((i: { kind: string }) => i.kind === "iap")).toBe(true);
    expect(android.purchasesEnabled).toBe(false);
    expect(android.items.some((i: { kind: string }) => i.kind === "iap")).toBe(false);

    const body = {
      store: "apple",
      productId: "br.com.imperiodebolso.gems_50",
      purchaseToken: jws(tx()),
    };
    const first = await post(ctx.app, g, "/purchases/verify", body);
    expect(first.statusCode).toBe(201);
    expect(first.json().gems).toBe("50");
    const again = await post(ctx.app, g, "/purchases/verify", body);
    expect(again.json().duplicate).toBe(true);
    const state = (await get(ctx.app, g, "/player/state")).json();
    expect(state.wallet.gems).toBe("50");

    // Mock e Google continuam fechados; recibo de outro app é recusado.
    const mock = await post(ctx.app, g, "/purchases/verify", { ...body, store: "mock" });
    expect(mock.statusCode).toBe(409);
    const otherApp = await post(ctx.app, g, "/purchases/verify", {
      ...body,
      purchaseToken: jws(tx({ transactionId: "9", bundleId: "com.outro.app" })),
    });
    expect(otherApp.json().error.code).toBe("PURCHASE_INVALID");
  });

  it("assinatura VIP usa a data de fim da Apple e o estorno (notificação V2) revoga", async () => {
    const g = await iosContext();
    const expires = Date.now() + 30 * 24 * 3600 * 1000;
    const vip = tx({
      transactionId: "3000000222",
      productId: "br.com.imperiodebolso.vip_monthly",
      type: "Auto-Renewable Subscription",
      expiresDate: expires,
    });
    const res = await post(ctx.app, g, "/purchases/verify", {
      store: "apple",
      productId: "br.com.imperiodebolso.vip_monthly",
      purchaseToken: jws(vip),
    });
    expect(res.statusCode).toBe(201);
    const sub = await ctx.db.subscription.findFirstOrThrow({ where: { playerId: g.playerId } });
    expect(sub.expiresAt.getTime()).toBe(expires);

    const note = jws({ notificationType: "REFUND", data: { signedTransactionInfo: jws(vip) } });
    const n = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/purchases/apple/notifications",
      payload: { signedPayload: note },
    });
    expect(n.json()).toEqual({ type: "REFUND", revoked: true });
    const after = await ctx.db.subscription.findFirstOrThrow({ where: { playerId: g.playerId } });
    expect(after.status).toBe("REVOKED");
  });
});
