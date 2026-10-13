import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const base = { DATABASE_URL: "postgresql://x", JWT_SECRET: "x".repeat(40) };

describe("configuração", () => {
  it("ADMIN_TOKEN vazio desliga o painel sem derrubar a API", () => {
    expect(loadConfig({ ...base, ADMIN_TOKEN: "" }).ADMIN_TOKEN).toBeUndefined();
    expect(loadConfig({ ...base }).ADMIN_TOKEN).toBeUndefined();
  });

  it("ADMIN_TOKEN curto é recusado", () => {
    expect(() => loadConfig({ ...base, ADMIN_TOKEN: "curto" })).toThrow(/ADMIN_TOKEN/);
  });

  it("produção recusa loja/anúncios em modo mock", () => {
    const prod = { ...base, NODE_ENV: "production", JWT_SECRET: "y".repeat(40) };
    expect(() => loadConfig(prod)).toThrow(/mock/);
    expect(loadConfig({ ...prod, STORE_MODE: "live", ADS_MODE: "admob" }).STORE_MODE).toBe("live");
  });

  it("teste fechado libera mock em produção só com BETA_SANDBOX=true explícito", () => {
    const prod = { ...base, NODE_ENV: "production", JWT_SECRET: "y".repeat(40) };
    expect(loadConfig({ ...prod, BETA_SANDBOX: "true" }).STORE_MODE).toBe("mock");
    expect(() => loadConfig({ ...prod, BETA_SANDBOX: "false" })).toThrow(/mock/);
    expect(() => loadConfig({ ...prod, BETA_SANDBOX: "yes" })).toThrow();
  });

  it("produção recusa JWT_SECRET de exemplo", () => {
    expect(() =>
      loadConfig({
        ...base,
        NODE_ENV: "production",
        JWT_SECRET: "troque-por-um-segredo-aleatorio-com-32",
      }),
    ).toThrow(/JWT_SECRET/);
  });
});
