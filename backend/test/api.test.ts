import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  coinsOf,
  createTestContext,
  get,
  key,
  newGuest,
  post,
  setCoins,
  type TestContext,
} from "./helpers.js";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.close();
});

describe("saúde e autenticação", () => {
  it("GET /health responde ok", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });

  it("cria convidado com 100 moedas e registra o crédito inicial no ledger", async () => {
    const guest = await newGuest(ctx.app);
    expect(guest.guestSecret.length).toBeGreaterThan(20);
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(100n);
    const ledger = await ctx.db.walletLedger.findMany({ where: { playerId: guest.playerId } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ delta: 100n, balanceAfter: 100n, reason: "initial_grant" });
  });

  it("retoma a mesma conta com guestId + segredo; segredo errado é recusado", async () => {
    const guest = await newGuest(ctx.app);
    const ok = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/guest",
      payload: { guestId: guest.guestId, guestSecret: guest.guestSecret },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().playerId).toBe(guest.playerId);
    expect(ok.json().guestSecret).toBeUndefined();

    const bad = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/guest",
      payload: { guestId: guest.guestId, guestSecret: "x".repeat(43) },
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().error.code).toBe("INVALID_GUEST_CREDENTIALS");
  });

  it("rotas do jogador exigem token válido", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/v1/player/state" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
  });
});

describe("catálogo e estado", () => {
  it("lista os 10 negócios, nenhum comprado, com saldo em string", async () => {
    const guest = await newGuest(ctx.app);
    const res = await get(ctx.app, guest, "/player/state");
    expect(res.statusCode).toBe(200);
    const state = res.json();
    expect(state.wallet).toEqual({ coins: "100", gems: "0" });
    expect(state.businesses).toHaveLength(10);
    expect(state.businesses.every((b: { owned: boolean }) => !b.owned)).toBe(true);
    expect(state.businesses[0]).toMatchObject({
      slug: "agua",
      cost: "100",
      profitPerCycle: "10",
      cycleSeconds: 10,
    });
    expect(state.serverTime).toBe("2026-01-01T12:00:00.000Z");

    const list = await get(ctx.app, guest, "/businesses");
    expect(list.json().businesses).toHaveLength(10);
  });
});

describe("compra de negócio", () => {
  it("compra o carrinho de água: debita, registra no ledger e inicia o ciclo", async () => {
    const guest = await newGuest(ctx.app);
    const res = await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" });
    expect(res.statusCode).toBe(201);
    const agua = res.json().state.businesses[0];
    expect(agua).toMatchObject({ owned: true, level: 1, nextUpgradeCost: "115", ready: false });
    expect(agua.cycleEndsAt).toBe("2026-01-01T12:00:10.000Z");
    expect(res.json().state.wallet.coins).toBe("0");

    const debit = await ctx.db.walletLedger.findFirst({
      where: { playerId: guest.playerId, reason: "business_purchase:agua" },
    });
    expect(debit).toMatchObject({ delta: -100n, balanceAfter: 0n });
  });

  it("exige Idempotency-Key em comandos econômicos", async () => {
    const guest = await newGuest(ctx.app);
    const res = await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" }, null);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(100n);
  });

  it("saldo insuficiente não altera nada", async () => {
    const guest = await newGuest(ctx.app);
    const res = await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "pipoca" });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({
      code: "INSUFFICIENT_FUNDS",
      details: { required: "500", available: "100" },
    });
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(100n);
    expect(await ctx.db.playerBusiness.count()).toBe(0);
  });

  it("não deixa comprar o mesmo negócio duas vezes", async () => {
    const guest = await newGuest(ctx.app);
    await setCoins(ctx.db, guest.playerId, 1_000n);
    await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" });
    const again = await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe("BUSINESS_ALREADY_OWNED");
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(900n);
  });

  it("negócio inexistente → 404; corpo inválido → 400", async () => {
    const guest = await newGuest(ctx.app);
    const missing = await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "nave" });
    expect(missing.statusCode).toBe(404);
    const invalid = await post(ctx.app, guest, "/businesses/purchase", { businessSlug: 42 });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("VALIDATION_ERROR");
  });
});

describe("idempotência e concorrência", () => {
  it("reenvio com a mesma chave devolve a mesma resposta e debita uma vez só", async () => {
    const guest = await newGuest(ctx.app);
    const k = key();
    const first = await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" }, k);
    const replay = await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" }, k);
    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toEqual(first.json());
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(0n);
    expect(await ctx.db.walletLedger.count({ where: { delta: { lt: 0 } } })).toBe(1);
  });

  it("mesma chave com corpo diferente → 422", async () => {
    const guest = await newGuest(ctx.app);
    await setCoins(ctx.db, guest.playerId, 1_000n);
    const k = key();
    await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" }, k);
    const other = await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "pipoca" }, k);
    expect(other.statusCode).toBe(422);
    expect(other.json().error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("10 compras simultâneas com chaves diferentes: só uma passa, saldo nunca negativo", async () => {
    const guest = await newGuest(ctx.app);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" }),
      ),
    );
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(9);
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(0n);
    expect(await ctx.db.walletLedger.count({ where: { delta: { lt: 0 } } })).toBe(1);
  });

  it("5 envios simultâneos com a mesma chave: mesma resposta, um único débito", async () => {
    const guest = await newGuest(ctx.app);
    const k = key();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" }, k),
      ),
    );
    expect(results.every((r) => r.statusCode === 201)).toBe(true);
    const [first, ...rest] = results.map((r) => r.json());
    for (const body of rest) expect(body).toEqual(first);
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(0n);
    expect(await ctx.db.walletLedger.count({ where: { delta: { lt: 0 } } })).toBe(1);
  });

  it("coletas simultâneas creditam o ciclo uma única vez", async () => {
    const guest = await newGuest(ctx.app);
    await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" });
    ctx.clock.advance(10);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => post(ctx.app, guest, "/production/collect", {})),
    );
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(10n);
  });
});

describe("produção e coleta", () => {
  it("antes do fim do ciclo a coleta é recusada com o tempo restante", async () => {
    const guest = await newGuest(ctx.app);
    await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" });
    ctx.clock.advance(4);
    const res = await post(ctx.app, guest, "/production/collect", { businessSlug: "agua" });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({
      code: "PRODUCTION_NOT_READY",
      details: { secondsRemaining: 6 },
    });
  });

  it("após o ciclo, coleta credita o lucro e reinicia o ciclo", async () => {
    const guest = await newGuest(ctx.app);
    await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" });
    ctx.clock.advance(10);
    const res = await post(ctx.app, guest, "/production/collect", { businessSlug: "agua" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: "10", collected: [{ slug: "agua", amount: "10" }] });
    const agua = res.json().state.businesses[0];
    expect(agua.cycleStartedAt).toBe("2026-01-01T12:00:10.000Z");
    expect(agua.ready).toBe(false);
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(10n);
  });

  it("sem gerente, tempo extra não acumula ciclos (só 1 ciclo pronto)", async () => {
    const guest = await newGuest(ctx.app);
    await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" });
    ctx.clock.advance(3_600);
    const res = await post(ctx.app, guest, "/production/collect", {});
    expect(res.json().total).toBe("10");
  });

  it("o cliente não controla o tempo: campos extras no corpo são ignorados", async () => {
    const guest = await newGuest(ctx.app);
    await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" });
    const res = await post(ctx.app, guest, "/production/collect", {
      businessSlug: "agua",
      now: "2030-01-01T00:00:00Z",
      elapsedSeconds: 99999,
    });
    expect(res.statusCode).toBe(409);
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(0n);
  });

  it("nada para coletar sem negócios prontos", async () => {
    const guest = await newGuest(ctx.app);
    const res = await post(ctx.app, guest, "/production/collect", {});
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("NOTHING_TO_COLLECT");
  });
});

describe("melhoria de negócio", () => {
  it("upgrade cobra 115, sobe para nível 2 e aumenta o lucro para 11", async () => {
    const guest = await newGuest(ctx.app);
    await setCoins(ctx.db, guest.playerId, 1_000n);
    await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" });
    const res = await post(ctx.app, guest, "/businesses/upgrade", { businessSlug: "agua" });
    expect(res.statusCode).toBe(200);
    expect(res.json().level).toBe(2);
    expect(res.json().state.businesses[0]).toMatchObject({
      level: 2,
      profitPerCycle: "11",
      nextUpgradeCost: "132",
    });
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(785n);

    ctx.clock.advance(10);
    const collect = await post(ctx.app, guest, "/production/collect", {});
    expect(collect.json().total).toBe("11");
  });

  it("não melhora negócio que não possui, nem sem saldo", async () => {
    const guest = await newGuest(ctx.app);
    const notOwned = await post(ctx.app, guest, "/businesses/upgrade", { businessSlug: "agua" });
    expect(notOwned.json().error.code).toBe("BUSINESS_NOT_OWNED");

    await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" });
    const broke = await post(ctx.app, guest, "/businesses/upgrade", { businessSlug: "agua" });
    expect(broke.json().error.code).toBe("INSUFFICIENT_FUNDS");
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(0n);
  });

  it("para no nível máximo", async () => {
    const guest = await newGuest(ctx.app);
    await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "agua" });
    await ctx.db.playerBusiness.updateMany({ data: { level: 100 } });
    await setCoins(ctx.db, guest.playerId, 10n ** 15n);
    const res = await post(ctx.app, guest, "/businesses/upgrade", { businessSlug: "agua" });
    expect(res.json().error.code).toBe("MAX_LEVEL_REACHED");
  });
});

describe("barreiras no banco", () => {
  it("CHECK impede saldo negativo mesmo fora da API", async () => {
    const guest = await newGuest(ctx.app);
    await expect(setCoins(ctx.db, guest.playerId, -1n)).rejects.toThrow();
  });
});

describe("distritos", () => {
  it("cidade começa bloqueada e o estado informa os distritos", async () => {
    const guest = await newGuest(ctx.app);
    const state = (await get(ctx.app, guest, "/player/state")).json();
    expect(state.districts).toEqual([
      { id: "praia", unlocked: true, requires: null },
      { id: "cidade", unlocked: false, requires: "praia" },
    ]);
    expect(state.businesses.find((b: { slug: string }) => b.slug === "mercadinho").district).toBe(
      "cidade",
    );
  });

  it("não deixa comprar na cidade antes de completar a praia, mesmo com saldo", async () => {
    const guest = await newGuest(ctx.app);
    await setCoins(ctx.db, guest.playerId, 100_000n);
    const res = await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "mercadinho" });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({
      code: "DISTRICT_LOCKED",
      details: { district: "cidade", requires: "praia" },
    });
    expect(await coinsOf(ctx.db, guest.playerId)).toBe(100_000n);
  });

  it("com os 4 negócios da praia a cidade libera e a compra passa", async () => {
    const guest = await newGuest(ctx.app);
    await setCoins(ctx.db, guest.playerId, 100_000n);
    for (const slug of ["agua", "pipoca", "sorveteria", "quiosque_coco"]) {
      const r = await post(ctx.app, guest, "/businesses/purchase", { businessSlug: slug });
      expect(r.statusCode).toBe(201);
    }
    const res = await post(ctx.app, guest, "/businesses/purchase", { businessSlug: "mercadinho" });
    expect(res.statusCode).toBe(201);
    expect(res.json().state.districts[1]).toMatchObject({ id: "cidade", unlocked: true });
  });
});
