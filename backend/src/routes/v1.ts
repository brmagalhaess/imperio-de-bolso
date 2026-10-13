import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { Db } from "../db/prisma.js";
import { AppError, Errors } from "../errors.js";
import {
  parseIdempotencyKey,
  runIdempotentCommand,
  type CommandResult,
} from "../lib/idempotency.js";
import { admobKeyResolver, type KeyResolver, SsvError, verifySsv } from "../lib/admob-ssv.js";
import { claimAd, mockComplete, ssvVerified, startAd } from "../services/ads.js";
import { CLIENT_EVENTS, track } from "../services/analytics.js";
import {
  restorePurchases,
  revokePurchase,
  verifierFor,
  verifyPurchase,
} from "../services/purchases.js";
import { deleteAccount } from "../services/account.js";
import { changeName } from "../services/profile.js";
import { buyWithGems, claimVipDaily, getCatalog } from "../services/store.js";
import { claimAchievement, listAchievements } from "../services/achievements.js";
import { createGuest, resumeGuest } from "../services/auth.js";
import { getLeaderboard } from "../services/leaderboard.js";
import { claimMission, listMissions } from "../services/missions.js";
import {
  collectProduction,
  completeTutorial,
  enterDistrict,
  getPlayerState,
  hireManager,
  listBusinesses,
  purchaseBusiness,
  upgradeBusiness,
} from "../services/game.js";

export interface V1Deps {
  config: AppConfig;
  db: Db;
  now: () => Date;
  /** Chaves públicas do SSV do AdMob (injetável nos testes). */
  admobKeys?: KeyResolver;
}

const Slug = z.string().regex(/^[a-z0-9_-]{1,64}$/);
const GuestAuthBody = z
  .object({ guestId: z.uuid(), guestSecret: z.string().min(16).max(256) })
  .partial()
  .refine((b) => Boolean(b.guestId) === Boolean(b.guestSecret), {
    message: "Informe guestId e guestSecret juntos, ou nenhum dos dois",
  });
const BusinessBody = z.object({ businessSlug: Slug });
const CollectBody = z.object({ businessSlug: Slug.optional() });
const PresenceBody = z.object({ district: Slug });
const MissionClaimBody = z.object({ missionId: z.uuid() });
const BuyBody = z.object({ itemId: Slug, district: Slug.optional() });
const VerifyBody = z.object({
  store: z.enum(["mock", "google", "apple"]),
  productId: z.string().min(3).max(120),
  purchaseToken: z.string().min(3).max(4096),
});
const AdStartBody = z.object({
  placement: z.enum(["ad_boost", "offline_double"]),
  district: Slug.optional(),
});
const AdSessionBody = z.object({ sessionId: z.uuid() });
const RefundBody = z.object({ transactionId: z.string().min(3).max(200) });
const AchievementClaimBody = z.object({ achievementId: Slug });
const EventsBody = z.object({
  events: z
    .array(
      z.object({
        name: z.enum(CLIENT_EVENTS),
        // Propriedades curtas e sem dados pessoais (validadas por tamanho).
        props: z
          .record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()]))
          .optional(),
      }),
    )
    .min(1)
    .max(20),
});

function playerIdOf(request: FastifyRequest): string {
  return request.user.sub;
}

export async function v1Routes(app: FastifyInstance, deps: V1Deps): Promise<void> {
  const { db, now, config } = deps;

  const authenticate = async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw Errors.unauthorized();
    }
    // Token ainda válido de uma conta excluída não serve mais (ADR 0009).
    const exists = await db.player.findUnique({
      where: { id: request.user.sub },
      select: { id: true },
    });
    if (!exists) throw Errors.unauthorized();
  };

  // Criar/retomar conta convidada: limite mais rígido por IP (evita criação em massa).
  app.post(
    "/auth/guest",
    {
      config: { rateLimit: { max: config.RATE_LIMIT_AUTH_PER_MINUTE, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const body = GuestAuthBody.parse(request.body ?? {});
      const session =
        body.guestId && body.guestSecret
          ? await resumeGuest(db, body.guestId, body.guestSecret)
          : await createGuest(db, config.STARTING_COINS);
      const accessToken = await reply.jwtSign(
        { sub: session.playerId },
        { expiresIn: config.JWT_EXPIRES_IN },
      );
      return reply.code(session.created ? 201 : 200).send({
        playerId: session.playerId,
        guestId: session.guestId,
        ...(session.guestSecret ? { guestSecret: session.guestSecret } : {}),
        accessToken,
        tokenType: "Bearer",
        expiresIn: config.JWT_EXPIRES_IN,
      });
    },
  );

  app.get("/player/state", { preHandler: authenticate }, async (request) =>
    getPlayerState(db, playerIdOf(request), now()),
  );

  app.get("/businesses", { preHandler: authenticate }, async (request) => {
    const at = now();
    return {
      businesses: await listBusinesses(db, playerIdOf(request), at),
      serverTime: at.toISOString(),
    };
  });

  const command = async (
    request: FastifyRequest,
    reply: FastifyReply,
    route: string,
    run: (at: Date) => Parameters<typeof runIdempotentCommand>[2],
  ) => {
    const key = parseIdempotencyKey(request.headers["idempotency-key"]);
    const result: CommandResult = await runIdempotentCommand(
      db,
      { playerId: playerIdOf(request), key, route, body: request.body },
      run(now()),
    );
    return reply.code(result.statusCode).send(result.body);
  };

  app.post("/businesses/purchase", { preHandler: authenticate }, async (request, reply) => {
    const { businessSlug } = BusinessBody.parse(request.body);
    return command(request, reply, "businesses.purchase", (at) =>
      purchaseBusiness(businessSlug, at),
    );
  });

  app.post("/businesses/upgrade", { preHandler: authenticate }, async (request, reply) => {
    const { businessSlug } = BusinessBody.parse(request.body);
    return command(request, reply, "businesses.upgrade", (at) => upgradeBusiness(businessSlug, at));
  });

  app.post("/production/collect", { preHandler: authenticate }, async (request, reply) => {
    const { businessSlug } = CollectBody.parse(request.body ?? {});
    return command(request, reply, "production.collect", (at) =>
      collectProduction(businessSlug, at),
    );
  });

  app.post("/managers/hire", { preHandler: authenticate }, async (request, reply) => {
    const { businessSlug } = BusinessBody.parse(request.body);
    return command(request, reply, "managers.hire", (at) => hireManager(businessSlug, at));
  });

  app.post("/presence", { preHandler: authenticate }, async (request, reply) => {
    const { district } = PresenceBody.parse(request.body);
    return command(request, reply, "presence", (at) => enterDistrict(district, at));
  });

  app.post("/tutorial/complete", { preHandler: authenticate }, async (request) => {
    const at = now();
    await completeTutorial(db, playerIdOf(request), at);
    return getPlayerState(db, playerIdOf(request), at);
  });

  app.get("/missions", { preHandler: authenticate }, async (request) =>
    listMissions(db, playerIdOf(request), now()),
  );

  app.post("/missions/claim", { preHandler: authenticate }, async (request, reply) => {
    const { missionId } = MissionClaimBody.parse(request.body);
    return command(request, reply, "missions.claim", (at) => claimMission(missionId, at));
  });

  app.get("/achievements", { preHandler: authenticate }, async (request) =>
    listAchievements(db, playerIdOf(request), now()),
  );

  app.post("/achievements/claim", { preHandler: authenticate }, async (request, reply) => {
    const { achievementId } = AchievementClaimBody.parse(request.body);
    return command(request, reply, "achievements.claim", (at) =>
      claimAchievement(achievementId, at),
    );
  });

  app.get("/leaderboard", { preHandler: authenticate }, async (request) =>
    getLeaderboard(db, playerIdOf(request), now()),
  );

  app.post("/analytics/events", { preHandler: authenticate }, async (request, reply) => {
    const { events } = EventsBody.parse(request.body);
    for (const e of events) await track(db, playerIdOf(request), e.name, e.props ?? {});
    return reply.code(202).send({ accepted: events.length });
  });

  // --- Loja, compras e anúncios (ADR 0008) ---------------------------------

  app.get("/store/catalog", { preHandler: authenticate }, async (request) => {
    const { district } = z.object({ district: Slug.optional() }).parse(request.query);
    return getCatalog(db, playerIdOf(request), now(), config.STORE_MODE, district);
  });

  app.post("/vip/daily", { preHandler: authenticate }, async (request, reply) =>
    command(request, reply, "vip.daily", (at) => claimVipDaily(at)),
  );

  app.post("/player/name", { preHandler: authenticate }, async (request) => {
    const { displayName } = z.object({ displayName: z.string().max(60) }).parse(request.body);
    const at = now();
    await changeName(db, playerIdOf(request), displayName, at);
    return getPlayerState(db, playerIdOf(request), at);
  });

  // Exclusão de conta (LGPD, ADR 0009): irreversível; exige a confirmação digitada.
  app.post("/player/delete", { preHandler: authenticate }, async (request) => {
    z.object({ confirm: z.literal("EXCLUIR") }).parse(request.body);
    await deleteAccount(db, playerIdOf(request));
    return { deleted: true };
  });

  app.post("/store/buy", { preHandler: authenticate }, async (request, reply) => {
    const { itemId, district } = BuyBody.parse(request.body);
    return command(request, reply, "store.buy", (at) => buyWithGems(itemId, district, at));
  });

  app.post("/purchases/verify", { preHandler: authenticate }, async (request, reply) => {
    const { store, productId, purchaseToken } = VerifyBody.parse(request.body);
    const verifier = verifierFor(store, config.STORE_MODE);
    return command(request, reply, "purchases.verify", (at) =>
      verifyPurchase(store, productId, purchaseToken, verifier, at),
    );
  });

  app.post("/purchases/restore", { preHandler: authenticate }, async (request) =>
    restorePurchases(db, playerIdOf(request), now()),
  );

  const ssvKeys = deps.admobKeys ?? admobKeyResolver(config.ADMOB_KEYS_URL);

  app.post("/ads/start", { preHandler: authenticate }, async (request, reply) => {
    const { placement, district } = AdStartBody.parse(request.body);
    return command(request, reply, "ads.start", (at) => startAd(placement, district, at));
  });

  app.post("/ads/claim", { preHandler: authenticate }, async (request, reply) => {
    const { sessionId } = AdSessionBody.parse(request.body);
    return command(request, reply, "ads.claim", (at) => claimAd(sessionId, at));
  });

  // Callback SSV do AdMob (chamado pelo Google, sem login; a assinatura é a autenticação).
  app.get("/ads/ssv", async (request, reply) => {
    if (config.ADS_MODE !== "admob") return reply.code(404).send();
    const raw = (request.raw.url ?? "").split("?")[1] ?? "";
    try {
      const params = await verifySsv(raw, ssvKeys);
      const ok = await ssvVerified(db, params, now());
      return reply.code(200).send({ verified: ok });
    } catch (err) {
      if (err instanceof SsvError)
        return reply.code(400).send({ error: { code: "SSV_INVALID", message: err.message } });
      throw err;
    }
  });

  // Somente desenvolvimento (modo mock): simulações claramente identificadas.
  if (config.ADS_MODE === "mock") {
    app.post("/ads/mock-complete", { preHandler: authenticate }, async (request) => {
      const { sessionId } = AdSessionBody.parse(request.body);
      await mockComplete(db, playerIdOf(request), sessionId, now());
      return { verified: true, mock: true };
    });
  }
  if (config.STORE_MODE === "mock") {
    app.post("/purchases/mock/refund", { preHandler: authenticate }, async (request) => {
      const { transactionId } = RefundBody.parse(request.body);
      const receipt = await db.purchaseReceipt.findUnique({
        where: { store_transactionId: { store: "mock", transactionId } },
      });
      if (!receipt || receipt.playerId !== playerIdOf(request)) {
        throw new AppError(404, "PURCHASE_NOT_FOUND", "Compra não encontrada");
      }
      return revokePurchase(db, "mock", transactionId, now());
    });
  }
}
