import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./helpers.js";

let ctx: TestContext;

afterEach(async () => {
  await ctx?.close();
});

describe("segurança da API", () => {
  it("limita a criação de contas por IP e responde no formato de erro padrão", async () => {
    ctx = await createTestContext({ RATE_LIMIT_AUTH_PER_MINUTE: "3" });
    const codes = [];
    for (let i = 0; i < 4; i++) {
      codes.push((await ctx.app.inject({ method: "POST", url: "/api/v1/auth/guest" })).statusCode);
    }
    expect(codes).toEqual([201, 201, 201, 429]);
    const limited = await ctx.app.inject({ method: "POST", url: "/api/v1/auth/guest" });
    expect(limited.json().error).toMatchObject({ code: "RATE_LIMITED" });
    expect(limited.json().error.details.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("limite geral por IP, sem contar o /health", async () => {
    ctx = await createTestContext({ RATE_LIMIT_PER_MINUTE: "5" });
    for (let i = 0; i < 8; i++) {
      expect((await ctx.app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    }
    const codes = [];
    for (let i = 0; i < 6; i++) {
      codes.push((await ctx.app.inject({ method: "GET", url: "/api/v1/player/state" })).statusCode);
    }
    expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
    expect(codes[5]).toBe(429);
  });

  it("envia cabeçalhos de segurança", async () => {
    ctx = await createTestContext();
    const res = await ctx.app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
