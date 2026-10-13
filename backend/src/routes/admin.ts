import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Db } from "../db/prisma.js";
import { AppError } from "../errors.js";
import { dayBounds } from "../lib/time.js";

// Painel administrativo mínimo (docs/README.md §3, Etapa 3): SOMENTE LEITURA.
// Autenticação: Authorization: Bearer <ADMIN_TOKEN>. Sem token configurado → rotas desligadas.

export interface AdminDeps {
  db: Db;
  token: string;
  now: () => Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const sha = (v: string) => createHash("sha256").update(v).digest();

export async function adminRoutes(app: FastifyInstance, deps: AdminDeps): Promise<void> {
  const { db, now } = deps;
  const expected = sha(deps.token);

  app.addHook("preHandler", async (request: FastifyRequest) => {
    const header = request.headers.authorization ?? "";
    const given = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!timingSafeEqual(sha(given), expected)) {
      throw new AppError(401, "ADMIN_UNAUTHORIZED", "Token de administrador inválido");
    }
  });

  app.get("/overview", async () => {
    const at = now();
    const { start: today } = dayBounds(at);
    const yesterday = new Date(today.getTime() - DAY_MS);
    const weekAgo = new Date(at.getTime() - 7 * DAY_MS);
    const [players, newToday, dau, wau, tutorial, coins, events, cohort, returned] =
      await Promise.all([
        db.player.count(),
        db.player.count({ where: { createdAt: { gte: today } } }),
        db.player.count({ where: { lastSeenAt: { gte: today } } }),
        db.player.count({ where: { lastSeenAt: { gte: weekAgo } } }),
        db.player.count({ where: { tutorialCompletedAt: { not: null } } }),
        db.playerWallet.aggregate({ _sum: { coins: true, gems: true } }),
        db.analyticsEvent.groupBy({
          by: ["name"],
          where: { createdAt: { gte: new Date(at.getTime() - DAY_MS) } },
          _count: { _all: true },
        }),
        db.player.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
        // Retenção D1 aproximada: criados ontem que abriram o jogo hoje.
        db.player.count({
          where: { createdAt: { gte: yesterday, lt: today }, lastSeenAt: { gte: today } },
        }),
      ]);
    return {
      players,
      newToday,
      dau,
      wau,
      tutorialCompletionRate: players ? tutorial / players : 0,
      d1Retention: cohort ? returned / cohort : null,
      coinsInCirculation: (coins._sum.coins ?? 0n).toString(),
      gemsInCirculation: (coins._sum.gems ?? 0n).toString(),
      eventsLast24h: Object.fromEntries(events.map((e) => [e.name, e._count._all])),
      serverTime: at.toISOString(),
    };
  });

  const PlayersQuery = z.object({
    search: z.string().max(60).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  });

  app.get("/players", async (request) => {
    const { search, limit } = PlayersQuery.parse(request.query);
    const players = await db.player.findMany({
      where: search ? { displayName: { contains: search, mode: "insensitive" } } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { wallet: true, _count: { select: { businesses: true } } },
    });
    return {
      players: players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        createdAt: p.createdAt.toISOString(),
        lastSeenAt: p.lastSeenAt?.toISOString() ?? null,
        currentDistrict: p.currentDistrict,
        tutorialCompleted: p.tutorialCompletedAt !== null,
        coins: (p.wallet?.coins ?? 0n).toString(),
        gems: (p.wallet?.gems ?? 0n).toString(),
        businesses: p._count.businesses,
      })),
    };
  });

  app.get("/players/:id", async (request) => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const player = await db.player.findUnique({
      where: { id },
      include: { wallet: true, businesses: { include: { business: true } } },
    });
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND", "Jogador não encontrado");
    const ledger = await db.walletLedger.findMany({
      where: { playerId: id },
      orderBy: { id: "desc" },
      take: 50,
    });
    return {
      id: player.id,
      displayName: player.displayName,
      coins: (player.wallet?.coins ?? 0n).toString(),
      gems: (player.wallet?.gems ?? 0n).toString(),
      businesses: player.businesses.map((pb) => ({
        slug: pb.business.slug,
        level: pb.level,
        helper: pb.managerUnlocked,
      })),
      ledger: ledger.map((l) => ({
        at: l.createdAt.toISOString(),
        currency: l.currency,
        delta: l.delta.toString(),
        balanceAfter: l.balanceAfter.toString(),
        reason: l.reason,
      })),
    };
  });

  app.get("/events", async (request) => {
    const { name, limit } = z
      .object({
        name: z.string().max(60).optional(),
        limit: z.coerce.number().int().min(1).max(200).default(100),
      })
      .parse(request.query);
    const events = await db.analyticsEvent.findMany({
      where: name ? { name } : {},
      orderBy: { id: "desc" },
      take: limit,
    });
    return {
      events: events.map((e) => ({
        id: e.id.toString(),
        playerId: e.playerId,
        name: e.name,
        props: e.props,
        at: e.createdAt.toISOString(),
      })),
    };
  });
}
