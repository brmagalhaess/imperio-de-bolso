import type { Prisma } from "../generated/prisma/client.js";
import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Db } from "../db/prisma.js";
import { AppError } from "../errors.js";
import { randomInt } from "node:crypto";
import { BUSINESS_CATALOG } from "../economy/catalog.js";
import { DISTRICTS } from "../economy/districts.js";
import { weekendEvent } from "../economy/events.js";
import { features } from "../lib/features.js";
import { dayBounds, gameDay, weekBounds } from "../lib/time.js";
import { PRODUCTION_REASONS } from "../services/achievements.js";
import { track } from "../services/analytics.js";
import { LEAGUES, weekId } from "../services/leaderboard.js";
import { insightsRoutes } from "./admin-insights.js";

// Painel administrativo (docs/README.md §3; ADR 0021/0030). Leitura de tudo; as escritas são de
// moderação (nomes denunciados, conta da equipe) e de suporte (diamantes de compensação e
// reembolso manual — routes/admin-insights.ts), registradas em analytics como "admin_*".
// Autenticação: Authorization: Bearer <ADMIN_TOKEN>. Sem token configurado → rotas desligadas.

export interface AdminDeps {
  db: Db;
  token: string;
  now: () => Date;
  googlePlay?: import("../lib/google-play.js").GooglePlayApi;
  storeVersions: import("../services/store-versions.js").StoreVersions;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Contas da equipe (testes) não aparecem em nenhuma tela nem número do painel — só no filtro
 * "Equipe" da lista de jogadores, para poder gerenciá-las.
 */
const REAL_PLAYER = { staff: false } satisfies Prisma.PlayerWhereInput;
const REAL_EVENT: Prisma.AnalyticsEventWhereInput = {
  OR: [{ playerId: null }, { player: { staff: false } }],
};
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
    const day = gameDay(at);
    const ev = weekendEvent(at);
    const d7Start = new Date(today.getTime() - 7 * DAY_MS);
    const [
      players,
      newToday,
      dau,
      wau,
      tutorial,
      coins,
      events,
      cohort,
      returned,
      cohort7,
      returned7,
      prestige,
      autoCollect,
      turbo,
      vip,
      identities,
      missionsToday,
      chestsToday,
      dailyToday,
      eventRows,
      openReports,
      gemsSpent,
      funnel,
    ] = await Promise.all([
      db.player.count({ where: REAL_PLAYER }),
      db.player.count({ where: { ...REAL_PLAYER, createdAt: { gte: today } } }),
      db.player.count({ where: { ...REAL_PLAYER, lastSeenAt: { gte: today } } }),
      db.player.count({ where: { ...REAL_PLAYER, lastSeenAt: { gte: weekAgo } } }),
      db.player.count({ where: { ...REAL_PLAYER, tutorialCompletedAt: { not: null } } }),
      db.playerWallet.aggregate({
        where: { player: REAL_PLAYER },
        _sum: { coins: true, gems: true },
      }),
      db.analyticsEvent.groupBy({
        by: ["name"],
        where: { ...REAL_EVENT, createdAt: { gte: new Date(at.getTime() - DAY_MS) } },
        _count: { _all: true },
      }),
      db.player.count({ where: { ...REAL_PLAYER, createdAt: { gte: yesterday, lt: today } } }),
      // Retenção D1 aproximada: criados ontem que abriram o jogo hoje.
      db.player.count({
        where: {
          ...REAL_PLAYER,
          createdAt: { gte: yesterday, lt: today },
          lastSeenAt: { gte: today },
        },
      }),
      db.player.count({
        where: {
          ...REAL_PLAYER,
          createdAt: { gte: d7Start, lt: new Date(d7Start.getTime() + DAY_MS) },
        },
      }),
      // Retenção D7 aproximada: criados há 7 dias que abriram o jogo hoje.
      db.player.count({
        where: {
          ...REAL_PLAYER,
          createdAt: { gte: d7Start, lt: new Date(d7Start.getTime() + DAY_MS) },
          lastSeenAt: { gte: today },
        },
      }),
      db.player.aggregate({
        where: { ...REAL_PLAYER, prestigeCount: { gt: 0 } },
        _count: { _all: true },
        _sum: { prestigeCount: true, prestigeStars: true },
      }),
      db.player.count({ where: { ...REAL_PLAYER, autoCollectUntil: { gt: at } } }),
      db.player.count({ where: { ...REAL_PLAYER, turboUntil: { gt: at } } }),
      db.subscription.count({
        where: {
          status: "ACTIVE",
          expiresAt: { gt: at },
          test: false,
          store: { not: "mock" },
          OR: [{ playerId: null }, { player: { staff: false } }],
        },
      }),
      db.playerIdentity.groupBy({
        by: ["provider"],
        where: { player: REAL_PLAYER },
        _count: { _all: true },
      }),
      db.playerMission.count({ where: { player: REAL_PLAYER, day, claimedAt: { not: null } } }),
      db.player.count({ where: { ...REAL_PLAYER, missionChestDay: day } }),
      db.player.count({ where: { ...REAL_PLAYER, lastLoginRewardDay: day } }),
      ev
        ? db.playerEvent.groupBy({
            by: ["eventId"],
            where: { eventId: ev.id, player: REAL_PLAYER },
            _count: { _all: true, claimedAt: true },
          })
        : Promise.resolve([]),
      db.playerReport.groupBy({ by: ["reportedId"], where: { resolvedAt: null } }),
      db.walletLedger.aggregate({
        where: {
          player: REAL_PLAYER,
          currency: "GEMS",
          delta: { lt: 0n },
          createdAt: { gte: today },
        },
        _sum: { delta: true },
      }),
      // Funil por mapa: jogadores com ao menos um negócio em cada distrito.
      db.$queryRaw<{ district: string; players: bigint }[]>`
          SELECT b.district, COUNT(DISTINCT pb.player_id) AS players
          FROM player_businesses pb JOIN business_definitions b ON b.id = pb.business_id
          JOIN players p ON p.id = pb.player_id AND NOT p.is_staff
          GROUP BY b.district`,
    ]);
    const evRow = eventRows[0];
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
      d7Retention: cohort7 ? returned7 / cohort7 : null,
      prestige: {
        players: prestige._count._all,
        sales: prestige._sum.prestigeCount ?? 0,
        stars: prestige._sum.prestigeStars ?? 0,
      },
      boosts: { autoCollect, turbo, vip },
      linkedAccounts: Object.fromEntries(identities.map((i) => [i.provider, i._count._all])),
      today: {
        missionsClaimed: missionsToday,
        chestsOpened: chestsToday,
        dailyRewards: dailyToday,
        gemsSpent: (-(gemsSpent._sum.delta ?? 0n)).toString(),
      },
      weekendEvent: ev
        ? {
            id: ev.id,
            participants: evRow?._count._all ?? 0,
            claimed: evRow?._count.claimedAt ?? 0,
          }
        : null,
      openReports: openReports.length,
      mapFunnel: DISTRICTS.map((d) => ({
        district: d,
        players: Number(funnel.find((f) => f.district === d)?.players ?? 0n),
      })),
      features: { ...features },
      serverTime: at.toISOString(),
    };
  });

  // --- Economia: os 67 negócios (dono, nível, ajudante, faixa visual) e o fluxo de moedas ---
  app.get("/economy", async () => {
    const at = now();
    const since = new Date(at.getTime() - 7 * DAY_MS);
    const [rows, flows] = await Promise.all([
      db.$queryRaw<
        {
          slug: string;
          owners: bigint;
          helpers: bigint;
          avg_level: number | null;
          max_level: number | null;
          t1: bigint;
          t2: bigint;
          t3: bigint;
          t4: bigint;
          t5: bigint;
        }[]
      >`
        SELECT b.slug,
               COUNT(pb.player_id) AS owners,
               COUNT(pb.player_id) FILTER (WHERE pb.manager_unlocked) AS helpers,
               AVG(pb.level)::float AS avg_level,
               MAX(pb.level) AS max_level,
               COUNT(*) FILTER (WHERE pb.level BETWEEN 1 AND 9) AS t1,
               COUNT(*) FILTER (WHERE pb.level BETWEEN 10 AND 24) AS t2,
               COUNT(*) FILTER (WHERE pb.level BETWEEN 25 AND 49) AS t3,
               COUNT(*) FILTER (WHERE pb.level BETWEEN 50 AND 99) AS t4,
               COUNT(*) FILTER (WHERE pb.level >= 100) AS t5
        FROM business_definitions b
        LEFT JOIN player_businesses pb ON pb.business_id = b.id
          AND pb.player_id NOT IN (SELECT id FROM players WHERE is_staff)
        GROUP BY b.slug`,
      // Agrupado pelo tipo (parte antes de ":"; ex.: business_upgrade:agua:12 → business_upgrade).
      db.$queryRaw<{ currency: string; reason: string; total: bigint; count: bigint }[]>`
        SELECT currency, split_part(reason, ':', 1) AS reason,
               SUM(delta) AS total, COUNT(*) AS count
        FROM wallet_ledger
        WHERE created_at >= ${since} AND player_id NOT IN (SELECT id FROM players WHERE is_staff)
        GROUP BY currency, split_part(reason, ':', 1)`,
    ]);
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    return {
      businesses: BUSINESS_CATALOG.map((b) => {
        const r = bySlug.get(b.slug);
        return {
          slug: b.slug,
          name: b.name,
          district: b.district,
          cost: b.cost.toString(),
          owners: Number(r?.owners ?? 0n),
          helpers: Number(r?.helpers ?? 0n),
          avgLevel: r?.avg_level ?? null,
          maxLevel: r?.max_level ?? null,
          tiers: [r?.t1, r?.t2, r?.t3, r?.t4, r?.t5].map((v) => Number(v ?? 0n)),
        };
      }),
      flows7d: flows
        .map((f) => ({
          currency: f.currency,
          reason: f.reason,
          total: BigInt(f.total).toString(),
          count: Number(f.count),
        }))
        .sort((a, b) => (BigInt(b.total) > BigInt(a.total) ? 1 : -1)),
    };
  });

  // --- Ranking: top da semana, tamanho das ligas e prêmios do pódio ---
  app.get("/ranking", async () => {
    const at = now();
    const { start, end } = weekBounds(at);
    const week = weekId(at);
    const prevWeek = weekId(new Date(at.getTime() - 7 * DAY_MS));
    const [top, leagues, rewards] = await Promise.all([
      db.$queryRaw<{ playerId: string; displayName: string; score: bigint }[]>`
        SELECT l.player_id AS "playerId", p.display_name AS "displayName", SUM(l.delta) AS score
        FROM wallet_ledger l JOIN players p ON p.id = l.player_id
        WHERE l.currency = 'COINS' AND l.reason = ANY(${PRODUCTION_REASONS})
          AND l.created_at >= ${start} AND l.created_at < ${end} AND NOT p.is_staff
        GROUP BY l.player_id, p.display_name
        ORDER BY score DESC LIMIT 20`,
      db.playerLeagueWeek.groupBy({
        by: ["league"],
        where: { week, player: REAL_PLAYER },
        _count: { _all: true },
      }),
      db.playerWeeklyReward.findMany({
        where: { week: prevWeek, player: REAL_PLAYER },
        include: { player: { select: { displayName: true } } },
        orderBy: [{ kind: "asc" }, { league: "asc" }, { rank: "asc" }],
      }),
    ]);
    return {
      week: { id: week, start: start.toISOString(), end: end.toISOString() },
      top: top.map((t, i) => ({ ...t, rank: i + 1, score: t.score.toString() })),
      leagues: LEAGUES.map((name, tier) => ({
        tier,
        name,
        players: leagues.find((l) => l.league === tier)?._count._all ?? 0,
      })),
      podium: {
        week: prevWeek,
        rewards: rewards.map((r) => ({
          playerId: r.playerId,
          displayName: r.player.displayName,
          kind: r.kind,
          league: r.league,
          rank: r.rank,
          gems: r.gems,
          claimed: r.claimedAt !== null,
        })),
      },
    };
  });

  // --- Moderação de nomes denunciados (diretriz 1.2 da App Store) ---
  app.get("/reports", async () => {
    const groups = await db.playerReport.groupBy({
      by: ["reportedId"],
      _count: { _all: true },
      _max: { createdAt: true },
      where: { resolvedAt: null, reported: REAL_PLAYER },
    });
    const players = await db.player.findMany({
      where: { id: { in: groups.map((g) => g.reportedId) } },
      select: { id: true, displayName: true, nameChangedAt: true },
    });
    const resolved = await db.playerReport.count({ where: { resolvedAt: { not: null } } });
    return {
      resolved,
      open: groups
        .map((g) => {
          const p = players.find((x) => x.id === g.reportedId);
          return {
            playerId: g.reportedId,
            displayName: p?.displayName ?? "—",
            customName: p?.nameChangedAt != null,
            reports: g._count._all,
            lastReportAt: g._max.createdAt?.toISOString() ?? null,
          };
        })
        .sort((a, b) => b.reports - a.reports),
    };
  });

  const ReportAction = z.object({ id: z.uuid() });

  app.post("/reports/:id/reset-name", async (request) => {
    const { id } = ReportAction.parse(request.params);
    const at = now();
    const player = await db.player.findUnique({ where: { id } });
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND", "Jogador não encontrado");
    const displayName = `Empreendedor ${randomInt(1000, 10000)}`;
    await db.player.update({ where: { id }, data: { displayName } });
    await db.playerReport.updateMany({
      where: { reportedId: id, resolvedAt: null },
      data: { resolvedAt: at },
    });
    await track(db, id, "admin_name_reset", { previous: player.displayName });
    return { playerId: id, displayName };
  });

  app.post("/reports/:id/dismiss", async (request) => {
    const { id } = ReportAction.parse(request.params);
    const r = await db.playerReport.updateMany({
      where: { reportedId: id, resolvedAt: null },
      data: { resolvedAt: now() },
    });
    await track(db, id, "admin_report_dismissed", { reports: r.count });
    return { playerId: id, dismissed: r.count };
  });

  // Conta da equipe: fora de todos os rankings e pódios (aparelho de desenvolvimento).
  for (const [action, staff] of [
    ["staff", true],
    ["unstaff", false],
  ] as const) {
    app.post(`/players/:id/${action}`, async (request) => {
      const { id } = z.object({ id: z.uuid() }).parse(request.params);
      const r = await db.player.updateMany({ where: { id }, data: { staff } });
      if (r.count === 0) throw new AppError(404, "PLAYER_NOT_FOUND", "Jogador não encontrado");
      await track(db, id, staff ? "admin_staff_on" : "admin_staff_off", {});
      return { playerId: id, staff };
    });
  }

  const PlayersQuery = z.object({
    search: z.string().max(60).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    sort: z.enum(["recent", "seen", "stars"]).default("recent"),
    /** "1" = só as contas da equipe (o único lugar onde elas aparecem). */
    staff: z.enum(["0", "1"]).default("0"),
  });

  app.get("/players", async (request) => {
    const { search, limit, sort, staff } = PlayersQuery.parse(request.query);
    let where: Prisma.PlayerWhereInput = search
      ? { displayName: { contains: search, mode: "insensitive" } }
      : {};
    where = { AND: [where, { staff: staff === "1" }] };
    // "Código do jogador" (Perfil do jogo / pedidos de suporte e exclusão) = 8 primeiros hex do id.
    const code = search?.trim().toLowerCase() ?? "";
    if (/^[0-9a-f]{8}$/.test(code)) {
      const rows = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM players WHERE id::text LIKE ${code + "%"}`;
      where = {
        AND: [{ OR: [where, { id: { in: rows.map((r) => r.id) } }] }, { staff: staff === "1" }],
      };
    }
    const players = await db.player.findMany({
      where,
      orderBy:
        sort === "seen"
          ? { lastSeenAt: { sort: "desc", nulls: "last" } }
          : sort === "stars"
            ? { prestigeStars: "desc" }
            : { createdAt: "desc" },
      take: limit,
      include: {
        wallet: true,
        _count: { select: { businesses: true, identities: true } },
      },
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
        prestigeStars: p.prestigeStars,
        linked: p._count.identities > 0,
        staff: p.staff,
        platform: p.platform,
        appVersion: p.appVersion,
      })),
    };
  });

  app.get("/players/:id", async (request) => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const player = await db.player.findUnique({
      where: { id },
      include: {
        wallet: true,
        businesses: { include: { business: true } },
        identities: { select: { provider: true, createdAt: true } },
      },
    });
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND", "Jogador não encontrado");
    const at = now();
    const [ledger, missions, achievements, league, reports, vip] = await Promise.all([
      db.walletLedger.findMany({ where: { playerId: id }, orderBy: { id: "desc" }, take: 100 }),
      db.playerMission.findMany({ where: { playerId: id, day: gameDay(at) } }),
      db.playerAchievement.count({ where: { playerId: id } }),
      db.playerLeagueWeek.findUnique({
        where: { playerId_week: { playerId: id, week: weekId(at) } },
      }),
      db.playerReport.count({ where: { reportedId: id, resolvedAt: null } }),
      db.subscription.findFirst({
        where: { playerId: id, status: "ACTIVE", expiresAt: { gt: at } },
        orderBy: { expiresAt: "desc" },
      }),
    ]);
    const iso = (d: Date | null) => d?.toISOString() ?? null;
    return {
      id: player.id,
      displayName: player.displayName,
      code: player.id.slice(0, 8).toUpperCase(),
      createdAt: player.createdAt.toISOString(),
      lastSeenAt: iso(player.lastSeenAt),
      currentDistrict: player.currentDistrict,
      tutorialCompleted: player.tutorialCompletedAt !== null,
      nameChanged: player.nameChangedAt !== null,
      staff: player.staff,
      platform: player.platform,
      appVersion: player.appVersion,
      coins: (player.wallet?.coins ?? 0n).toString(),
      gems: (player.wallet?.gems ?? 0n).toString(),
      prestige: { stars: player.prestigeStars, count: player.prestigeCount },
      league: league ? LEAGUES[league.league] : null,
      loginStreak: player.loginStreak,
      boosts: {
        vipUntil: iso(vip?.expiresAt ?? null),
        autoCollectUntil:
          player.autoCollectUntil && player.autoCollectUntil > at
            ? iso(player.autoCollectUntil)
            : null,
        turboUntil: player.turboUntil && player.turboUntil > at ? iso(player.turboUntil) : null,
      },
      identities: player.identities.map((i) => i.provider),
      achievements,
      openReports: reports,
      missionsToday: missions.map((m) => ({
        template: m.template,
        progress: m.progress.toString(),
        target: m.target.toString(),
        claimed: m.claimedAt !== null,
      })),
      businesses: player.businesses
        .sort((a, b) => a.business.sortOrder - b.business.sortOrder)
        .map((pb) => ({
          slug: pb.business.slug,
          name: pb.business.name,
          district: pb.business.district,
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
      where: { ...(name ? { name } : {}), ...REAL_EVENT },
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

  await insightsRoutes(app, {
    db,
    now,
    googlePlay: deps.googlePlay,
    storeVersions: deps.storeVersions,
  });
}
