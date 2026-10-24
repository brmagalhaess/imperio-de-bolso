import { afterEach, describe, expect, it } from "vitest";
import { missionRewardCoins, rewardCap } from "../src/economy/missions.js";
import { createTestContext, get, newGuest, post, setCoins, type TestContext } from "./helpers.js";

// Justiça da economia e do ranking (ADR 0029): prêmios com teto no estágio do jogador, virada
// da semana sem herdar produção do domingo e compartilhamento da posição.
// Relógio dos testes: quinta, 2026-01-01 09:00 (Brasília); a semana vira na segunda 05/01 00:00.

let ctx: TestContext;

afterEach(async () => {
  await ctx?.close();
});

const HOUR = 3600;

describe("teto dos prêmios em moedas", () => {
  it("missão nunca paga mais que o próximo negócio a construir", () => {
    const base = {
      ownedCount: 1,
      canBuy: true,
      canHire: false,
      hasHelper: true,
      cityUnlocked: false,
    };
    // Vendeu o império: renda alta (estrelas) no 1º mapa, próximo negócio custa 250.
    expect(missionRewardCoins({ ...base, incomePerSecond: 1_000_000, cheapestBuy: 250 })).toBe(
      250n,
    );
    // Jogador comum: 15 min de renda < próximo negócio → paga os 15 min.
    expect(missionRewardCoins({ ...base, incomePerSecond: 1, cheapestBuy: 25_000 })).toBe(900n);
    // Império completo: sem teto.
    expect(rewardCap(null)).toBe(Infinity);
    expect(missionRewardCoins({ ...base, incomePerSecond: 1_000, cheapestBuy: null })).toBe(
      900_000n,
    );
  });

  it("prêmio diário de quem vendeu o império respeita o mesmo teto", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await ctx.db.player.update({ where: { id: g.playerId }, data: { prestigeStars: 400 } });
    await setCoins(ctx.db, g.playerId, 1_000n);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await ctx.db.playerBusiness.updateMany({
      where: { playerId: g.playerId },
      data: { level: 100 },
    });
    const daily = (await get(ctx.app, g, "/daily-reward")).json();
    // Dia 1 = 10 min de renda: bem mais que a pipoca (250), então paga o teto (o piso fixo de
    // cada dia continua valendo: dia 6 dá no mínimo 5.000).
    expect(daily.rewards[0].coins).toBe("250");
    expect(daily.rewards[5].coins).toBe("5000");
    const missions = (await get(ctx.app, g, "/missions")).json().missions;
    for (const m of missions) expect(BigInt(m.rewardCoins)).toBeLessThanOrEqual(250n);
  });
});

describe("virada da semana", () => {
  it("produção dos ajudantes no domingo fica na semana anterior", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await get(ctx.app, g, "/leaderboard");
    ctx.clock.advance((3 * 24 + 14) * HOUR); // domingo 04/01 23:00
    await setCoins(ctx.db, g.playerId, 1_000n);
    await post(ctx.app, g, "/businesses/purchase", { businessSlug: "agua" });
    await post(ctx.app, g, "/managers/hire", { businessSlug: "agua" });
    ctx.clock.advance(2 * HOUR); // segunda 05/01 01:00 (1 h no domingo + 1 h na segunda)
    const total = BigInt(
      (await post(ctx.app, g, "/presence", { district: "cidade" })).json().total,
    );
    expect(total).toBeGreaterThan(0n);
    const lb = (await get(ctx.app, g, "/leaderboard")).json();
    const week = BigInt(lb.me.score);
    // Metade (±1 ciclo) do que os ajudantes fizeram conta na semana nova.
    expect(week * 2n).toBeGreaterThanOrEqual(total - 30n);
    expect(week * 2n).toBeLessThanOrEqual(total + 30n);
  });
});

describe("compartilhar a posição", () => {
  it("página do post traz a posição do jogador; conta da equipe não", async () => {
    ctx = await createTestContext();
    const g = await newGuest(ctx.app);
    await ctx.db.walletLedger.create({
      data: {
        playerId: g.playerId,
        currency: "COINS",
        delta: 5_000n,
        balanceAfter: 5_000n,
        reason: "production_collect",
        createdAt: ctx.clock.now,
      },
    });
    const name = (await ctx.db.player.findUniqueOrThrow({ where: { id: g.playerId } })).displayName;
    const page = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/share/rank/${g.playerId}?t=semana`,
    });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain(
      `${name} está em 1º lugar no ranking da semana do Império de Bolso!`,
    );
    expect(page.body).toContain(
      'og:image" content="https://imperio.crowntech.com.br/img/compartilhar.jpg"',
    );

    // Aberta pelo jogo (s=1): folha de compartilhar com a imagem montada e o link do post.
    const sheet = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/share/rank/${g.playerId}?t=semana&s=1`,
    });
    expect(sheet.body).toContain("navigator.share");
    expect(sheet.body).toContain("Compartilhar");
    expect(sheet.body).toContain("wa.me");
    const card = await ctx.app.inject({ method: "GET", url: "/api/v1/share/rank/card.jpg" });
    expect(card.statusCode).toBe(200);
    expect(card.headers["content-type"]).toBe("image/jpeg");
    expect(card.rawPayload.length).toBeGreaterThan(10_000);

    await ctx.db.player.update({ where: { id: g.playerId }, data: { staff: true } });
    const staff = await ctx.app.inject({ method: "GET", url: `/api/v1/share/rank/${g.playerId}` });
    expect(staff.body).not.toContain("lugar");
    expect(
      (await ctx.app.inject({ method: "GET", url: "/api/v1/share/rank/abc" })).statusCode,
    ).toBe(400);
  });
});
