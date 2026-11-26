import type { Prisma } from "../generated/prisma/client.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/prisma.js";
import { AppError } from "../errors.js";
import { BUNDLES } from "../economy/bundles.js";
import { STORE_ITEMS } from "../economy/store.js";
import { runIdempotentCommand } from "../lib/idempotency.js";
import { dayBounds, gameDay } from "../lib/time.js";
import { track } from "../services/analytics.js";
import { revokePurchase, type StoreName } from "../services/purchases.js";
import { applyGems } from "../services/wallet.js";
import type { GooglePlayApi } from "../lib/google-play.js";
import { STORE_URLS, type StoreVersions } from "../services/store-versions.js";

// Painel admin v3 (ADR 0030): tendências por dia, receita das lojas e ações de suporte
// (diamantes de compensação e reembolso manual). Registrado dentro de adminRoutes, atrás do
// mesmo ADMIN_TOKEN. Toda escrita fica no ledger/analytics como "admin_*".

const DAY_MS = 24 * 60 * 60 * 1000;

/** productId → nome e preço (R$) do catálogo, para estimar a receita bruta. */
const PRODUCTS = new Map<string, { title: string; priceBRL: number }>();
for (const i of STORE_ITEMS) {
  if ("productId" in i && "priceBRL" in i) {
    PRODUCTS.set(i.productId, { title: i.title, priceBRL: Number(i.priceBRL.replace(",", ".")) });
  }
}
for (const b of BUNDLES) {
  PRODUCTS.set(b.productId, { title: b.title, priceBRL: Number(b.priceBRL.replace(",", ".")) });
}
const priceOf = (productId: string) => PRODUCTS.get(productId)?.priceBRL ?? 0;

/**
 * Compra real (entra na receita e nas estatísticas): sem a loja "mock", fora do Sandbox da Apple
 * e dos testadores do Google, e de quem não é da equipe. As de teste ficam só no registro.
 */
const REAL: Prisma.PurchaseReceiptWhereInput = {
  test: false,
  store: { not: "mock" },
  OR: [{ playerId: null }, { player: { staff: false } }],
};
const round2 = (v: number) => Math.round(v * 100) / 100;

export interface InsightsDeps {
  db: Db;
  now: () => Date;
  /** API do Google Play (faixas de lançamento); ausente = versão do Google desconhecida. */
  googlePlay?: GooglePlayApi;
  /** Versão no ar em cada loja (cache compartilhado com o aviso de atualização do jogo). */
  storeVersions: StoreVersions;
}

export async function insightsRoutes(app: FastifyInstance, deps: InsightsDeps): Promise<void> {
  const { db, now } = deps;

  // --- Versão publicada em cada loja (card da visão geral; guardada por 10 min) -------------
  app.get("/stores", async (request) => {
    const fresh = (request.query as { fresh?: string }).fresh === "1";
    // No ar = o que dá para baixar agora (páginas públicas); enviada = faixa do Play Console.
    const live = await deps.storeVersions(fresh);
    const apple: Record<string, unknown> = {
      version: live.ios.version,
      releasedAt: live.ios.releasedAt,
      url: STORE_URLS.ios,
      ...(live.ios.version ? {} : { error: "App Store não respondeu" }),
    };
    let google: Record<string, unknown> = {
      version: live.android.version,
      url: STORE_URLS.android,
      ...(live.android.version ? {} : { error: "Google Play não respondeu" }),
    };
    if (deps.googlePlay?.tracks) {
      try {
        const releases = await deps.googlePlay.tracks();
        const pick = (r?: (typeof releases)[number]) =>
          r && {
            version: r.name?.split(" ")[0] ?? null,
            code: r.versionCodes?.[0] ?? null,
            status: r.status ?? null,
            rollout: r.userFraction ?? (r.status === "completed" ? 1 : null),
          };
        const prod = pick(releases.find((r) => r.track === "production" && r.status !== "draft"));
        google = {
          ...google,
          code: prod?.code ?? null,
          status: prod?.status ?? null,
          rollout: prod?.rollout ?? null,
          // Enviada à produção mas ainda não no ar (em revisão ou propagando).
          submitted: prod && prod.version !== live.android.version ? prod : null,
          testing: pick(releases.find((r) => r.track === "internal")) ?? null,
        };
      } catch {
        /* só a versão no ar */
      }
    }
    const versions = await db.player.groupBy({
      by: ["platform", "appVersion"],
      where: {
        staff: false,
        platform: { not: null },
        lastSeenAt: { gte: new Date(now().getTime() - 7 * DAY_MS) },
      },
      _count: { _all: true },
    });
    const inUse = (platform: string) =>
      versions
        .filter((v) => v.platform === platform)
        .map((v) => ({ version: v.appVersion ?? "antiga", players: v._count._all }))
        .sort((a, b) => b.players - a.players);
    const body = {
      apple: { ...apple, inUse: inUse("ios") },
      google: { ...google, inUse: inUse("android") },
      checkedAt: now().toISOString(),
    };
    return body;
  });

  // --- Tendências: uma linha por dia (Brasília) nos últimos N dias ---------------------------
  app.get("/trends", async (request) => {
    const { days } = z
      .object({ days: z.coerce.number().int().min(7).max(90).default(30) })
      .parse(request.query);
    const at = now();
    const end = dayBounds(at).end;
    const start = new Date(end.getTime() - days * DAY_MS);
    const dayOf = (d: Date) => gameDay(d);
    const [players, active, receipts, ads, prestiges] = await Promise.all([
      db.player.findMany({
        where: { createdAt: { gte: start }, staff: false },
        select: { createdAt: true },
      }),
      // Ativos = jogadores com qualquer lançamento no ledger no dia (coleta, compra, prêmio…).
      db.$queryRaw<{ day: string; players: bigint }[]>`
        SELECT to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day,
               COUNT(DISTINCT player_id) AS players
        FROM wallet_ledger
        WHERE created_at >= ${start} AND player_id NOT IN (SELECT id FROM players WHERE is_staff)
        GROUP BY 1`,
      db.purchaseReceipt.findMany({
        where: { ...REAL, createdAt: { gte: start } },
        select: { createdAt: true, productId: true, status: true },
      }),
      db.adReward.findMany({
        where: { createdAt: { gte: start }, status: "CLAIMED", player: { staff: false } },
        select: { createdAt: true },
      }),
      db.analyticsEvent.findMany({
        where: { name: "prestige", createdAt: { gte: start } },
        select: { createdAt: true },
      }),
    ]);
    const rows = new Map<
      string,
      {
        day: string;
        newPlayers: number;
        activePlayers: number;
        purchases: number;
        revenueBRL: number;
        adViews: number;
        prestiges: number;
      }
    >();
    for (let i = 0; i < days; i++) {
      const day = dayOf(new Date(start.getTime() + i * DAY_MS + DAY_MS / 2));
      rows.set(day, {
        day,
        newPlayers: 0,
        activePlayers: 0,
        purchases: 0,
        revenueBRL: 0,
        adViews: 0,
        prestiges: 0,
      });
    }
    for (const p of players) {
      const r = rows.get(dayOf(p.createdAt));
      if (r) r.newPlayers++;
    }
    for (const a of active) {
      const r = rows.get(a.day);
      if (r) r.activePlayers = Number(a.players);
    }
    for (const rc of receipts) {
      const r = rows.get(dayOf(rc.createdAt));
      if (r && rc.status === "VERIFIED") {
        r.purchases++;
        r.revenueBRL = round2(r.revenueBRL + priceOf(rc.productId));
      }
    }
    for (const a of ads) {
      const r = rows.get(dayOf(a.createdAt));
      if (r) r.adViews++;
    }
    for (const p of prestiges) {
      const r = rows.get(dayOf(p.createdAt));
      if (r) r.prestiges++;
    }
    return { days: [...rows.values()], serverTime: at.toISOString() };
  });

  // --- De onde vêm os jogadores: iPhone x Android (aparelho da última abertura do jogo) -------
  app.get("/platforms", async () => {
    const at = now();
    const today = dayBounds(at).start;
    const week = new Date(at.getTime() - 7 * DAY_MS);
    const [players, versions] = await Promise.all([
      db.player.findMany({
        where: { staff: false },
        select: { platform: true, createdAt: true, lastSeenAt: true },
      }),
      db.player.groupBy({
        by: ["platform", "appVersion"],
        where: { staff: false, platform: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const rows = ["ios", "android", "desconhecida"].map((platform) => {
      const list = players.filter((p) => (p.platform ?? "desconhecida") === platform);
      return {
        platform,
        players: list.length,
        newToday: list.filter((p) => p.createdAt >= today).length,
        new7d: list.filter((p) => p.createdAt >= week).length,
        activeToday: list.filter((p) => p.lastSeenAt && p.lastSeenAt >= today).length,
        active7d: list.filter((p) => p.lastSeenAt && p.lastSeenAt >= week).length,
        versions: versions
          .filter((v) => v.platform === platform)
          .map((v) => ({ version: v.appVersion ?? "antiga (sem versão)", players: v._count._all }))
          .sort((a, b) => b.players - a.players),
      };
    });
    return { platforms: rows, serverTime: at.toISOString() };
  });

  // --- Receita: compras reais (Apple/Google; o "mock" de teste fica de fora) -----------------
  app.get("/revenue", async () => {
    const at = now();
    const since30 = new Date(at.getTime() - 30 * DAY_MS);
    const [receipts, subs, recent, tests] = await Promise.all([
      db.purchaseReceipt.findMany({
        where: REAL,
        select: { productId: true, store: true, status: true, createdAt: true, playerId: true },
      }),
      db.subscription.groupBy({
        by: ["store"],
        where: {
          status: "ACTIVE",
          expiresAt: { gt: at },
          test: false,
          store: { not: "mock" },
          OR: [{ playerId: null }, { player: { staff: false } }],
        },
        _count: { _all: true },
      }),
      // A lista mostra também as de teste (marcadas), para conferência.
      db.purchaseReceipt.findMany({
        where: { OR: [{ playerId: null }, { player: { staff: false } }] },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { player: { select: { displayName: true, staff: true } } },
      }),
      db.purchaseReceipt.count({
        where: { NOT: REAL, OR: [{ playerId: null }, { player: { staff: false } }] },
      }),
    ]);
    const ok = receipts.filter((r) => r.status === "VERIFIED");
    const sum = (list: typeof receipts) =>
      round2(list.reduce((s, r) => s + priceOf(r.productId), 0));
    const byProduct = new Map<string, { count: number; revenueBRL: number; refunds: number }>();
    for (const r of receipts) {
      const row = byProduct.get(r.productId) ?? { count: 0, revenueBRL: 0, refunds: 0 };
      if (r.status === "VERIFIED") {
        row.count++;
        row.revenueBRL = round2(row.revenueBRL + priceOf(r.productId));
      } else row.refunds++;
      byProduct.set(r.productId, row);
    }
    const byStore = (store: string) => ok.filter((r) => r.store === store);
    return {
      totals: {
        revenueBRL: sum(ok),
        revenue30dBRL: sum(ok.filter((r) => r.createdAt >= since30)),
        purchases: ok.length,
        purchases30d: ok.filter((r) => r.createdAt >= since30).length,
        refunds: receipts.length - ok.length,
        /** Compras de teste (Sandbox, testadores, equipe): registradas, fora da receita. */
        testPurchases: tests,
        buyers: new Set(ok.map((r) => r.playerId).filter(Boolean)).size,
        activeSubscriptions: Object.fromEntries(subs.map((s) => [s.store, s._count._all])),
      },
      byStore: ["apple", "google"].map((store) => ({
        store,
        purchases: byStore(store).length,
        revenueBRL: sum(byStore(store)),
      })),
      byProduct: [...byProduct.entries()]
        .map(([productId, v]) => ({
          productId,
          title: PRODUCTS.get(productId)?.title ?? productId,
          priceBRL: priceOf(productId),
          ...v,
        }))
        .sort((a, b) => b.revenueBRL - a.revenueBRL),
      recent: recent.map((r) => ({
        at: r.createdAt.toISOString(),
        playerId: r.playerId,
        displayName: r.player?.displayName ?? "(conta excluída)",
        productId: r.productId,
        title: PRODUCTS.get(r.productId)?.title ?? r.productId,
        priceBRL: priceOf(r.productId),
        store: r.store,
        transactionId: r.transactionId,
        status: r.status,
        test: r.test || r.store === "mock" || (r.player?.staff ?? false),
      })),
      serverTime: at.toISOString(),
    };
  });

  // --- Suporte: diamantes de compensação (idempotente, fica no ledger) -----------------------
  app.post("/players/:id/gems", async (request, reply) => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const { amount, note } = z
      .object({
        amount: z.number().int().min(1).max(10_000),
        note: z.string().trim().min(3).max(120),
      })
      .parse(request.body);
    const key = z
      .string()
      .regex(/^[A-Za-z0-9_-]{8,128}$/)
      .parse(request.headers["idempotency-key"]);
    const exists = await db.player.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError(404, "PLAYER_NOT_FOUND", "Jogador não encontrado");
    const at = now();
    const result = await runIdempotentCommand(
      db,
      { playerId: id, key: `admin-${key}`, route: "admin.gems", body: { amount, note } },
      async ({ tx, wallet }) => {
        const w = await applyGems(
          tx,
          wallet,
          BigInt(amount),
          "admin_grant",
          `admin-gems:${key}`,
          at,
        );
        await track(tx, id, "admin_gems_granted", { amount, note });
        return { statusCode: 200, body: { playerId: id, gems: w.gems.toString() } };
      },
    );
    return reply.status(result.statusCode).send(result.body);
  });

  // --- Suporte: reembolso manual (ex.: Google, até as notificações automáticas) -------------
  app.post("/purchases/revoke", async (request) => {
    const { store, transactionId } = z
      .object({ store: z.enum(["apple", "google"]), transactionId: z.string().min(3).max(200) })
      .parse(request.body);
    const r = await revokePurchase(db, store as StoreName, transactionId, now());
    await track(db, null, "admin_purchase_revoked", { store, transactionId });
    return r;
  });

  // --- Compras de um jogador (ficha do jogador) ---------------------------------------------
  app.get("/players/:id/purchases", async (request) => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const rows = await db.purchaseReceipt.findMany({
      where: { playerId: id },
      include: { player: { select: { staff: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      purchases: rows.map((r) => ({
        at: r.createdAt.toISOString(),
        productId: r.productId,
        title: PRODUCTS.get(r.productId)?.title ?? r.productId,
        priceBRL: priceOf(r.productId),
        store: r.store,
        transactionId: r.transactionId,
        status: r.status,
        test: r.test || r.store === "mock" || (r.player?.staff ?? false),
      })),
    };
  });
}
