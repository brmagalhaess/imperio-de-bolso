import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, get, newGuest, post, type TestContext } from "./helpers.js";

let ctx: TestContext;
afterEach(async () => ctx?.close());

describe("anúncios só no iPhone (ADS_PLATFORMS=ios)", () => {
  it("catálogo e /ads/start liberam o iOS e recusam Android/sem plataforma", async () => {
    ctx = await createTestContext({ ADS_ENABLED: "false", ADS_PLATFORMS: "ios" });
    const g = await newGuest(ctx.app);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    const ios = (await get(ctx.app, g, "/store/catalog?platform=ios")).json();
    const android = (await get(ctx.app, g, "/store/catalog?platform=android")).json();
    expect(ios.adsEnabled).toBe(true);
    expect(ios.adsMode).toBe("mock");
    expect(ios.items.some((i: { kind: string }) => i.kind === "ad")).toBe(true);
    expect(android.adsEnabled).toBe(false);
    expect(android.items.some((i: { kind: string }) => i.kind === "ad")).toBe(false);

    const android409 = await post(ctx.app, g, "/ads/start", {
      placement: "ad_boost",
      platform: "android",
    });
    expect(android409.statusCode).toBe(409);
    expect(android409.json().error.code).toBe("ADS_DISABLED");
    const none = await post(ctx.app, g, "/ads/start", { placement: "ad_boost" });
    expect(none.statusCode).toBe(409);

    const start = await post(ctx.app, g, "/ads/start", {
      placement: "ad_boost",
      district: "praia",
      platform: "ios",
    });
    expect(start.statusCode).toBe(201);
    const sessionId = start.json().sessionId;
    expect((await post(ctx.app, g, "/ads/mock-complete", { sessionId }, null)).statusCode).toBe(
      200,
    );
    const claim = await post(ctx.app, g, "/ads/claim", { sessionId });
    expect(claim.json().coins).toBe("900");
    expect(claim.statusCode).toBe(200);
  });

  it("produção recusa ADS_PLATFORMS com anúncio de teste", async () => {
    const { loadConfig } = await import("../src/config.js");
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://x@localhost/x",
        JWT_SECRET: "segredo-de-producao-com-mais-de-32-caracteres!!",
        ADS_PLATFORMS: "ios",
        ADS_MODE: "mock",
      }),
    ).toThrow(/mock/);
  });
});
