import type { Prisma } from "../generated/prisma/client.js";
import type { GooglePlayApi } from "../lib/google-play.js";
import { STORE_URLS, type StoreVersions } from "../services/store-versions.js";
import { reportPlayer } from "../services/reports.js";
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
import { type JwkResolver, remoteJwkResolver } from "../lib/id-token.js";
import {
  linkConfig,
  linkIdentity,
  listIdentities,
  signInWithIdentity,
} from "../services/identities.js";
import { claimAd, mockComplete, ssvVerified, startAd } from "../services/ads.js";
import { CLIENT_EVENTS, track } from "../services/analytics.js";
import {
  handleAppleNotification,
  restorePurchases,
  revokePurchase,
  verifierFor,
  verifyPurchase,
} from "../services/purchases.js";
import { STORE_PLATFORM, adsFor, features, purchasesFor, storePlatform } from "../lib/features.js";
import { deleteAccount } from "../services/account.js";
import { getPrestige, sellEmpire } from "../services/prestige.js";
import { changeName } from "../services/profile.js";
import { buyWithGems, claimVipDaily, getCatalog } from "../services/store.js";
import { claimAchievement, listAchievements } from "../services/achievements.js";
import { createGuest, resumeGuest } from "../services/auth.js";
import {
  claimWeeklyReward,
  getLeaderboard,
  getStarsRanking,
  getWeeklyRewards,
} from "../services/leaderboard.js";
import {
  claimDailyReward,
  claimEvent,
  claimMissionChest,
  getDailyReward,
  getEvent,
} from "../services/retention.js";
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
  /** Chaves públicas do Google/Apple para ID tokens (injetável nos testes). */
  idKeys?: JwkResolver;
  /** Testes: raiz própria no lugar da Apple Root CA - G3 (recibos da App Store). */
  appleRootFingerprint?: string;
  /** API do Google Play; sem ela usa a conta de serviço do env (GOOGLE_PLAY_SERVICE_ACCOUNT). */
  googlePlay?: GooglePlayApi;
  /** Versão no ar em cada loja (aviso de atualização). */
  storeVersions?: StoreVersions;
}

const Slug = z.string().regex(/^[a-z0-9_-]{1,64}$/);
const GuestAuthBody = z
  .object({ guestId: z.uuid(), guestSecret: z.string().min(16).max(256) })
  .partial()
  .refine((b) => Boolean(b.guestId) === Boolean(b.guestSecret), {
    message: "Informe guestId e guestSecret juntos, ou nenhum dos dois",
  });
const BusinessBody = z.object({ businessSlug: Slug });
const IdentityBody = z.object({
  provider: z.enum(["google", "apple"]),
  idToken: z.string().min(20).max(8192),
});
const CollectBody = z.object({ businessSlug: Slug.optional() });
const PresenceBody = z.object({ district: Slug });
const MissionClaimBody = z.object({ missionId: z.uuid() });
const BuyBody = z.object({ itemId: Slug, district: Slug.optional() });
const VerifyBody = z.object({
  store: z.enum(["mock", "google", "apple"]),
  productId: z.string().min(3).max(120),
  // O JWS da App Store traz a cadeia x5c (3 certificados) e passa de 6 KB; o token do Google é curto.
  purchaseToken: z.string().min(3).max(32_768),
  // Mapa atual: a coleta antecipada dos pacotes (ADR 0024) é entregue nele.
  district: Slug.optional(),
});
const AdStartBody = z.object({
  placement: z.enum(["ad_boost", "offline_double"]),
  district: Slug.optional(),
  platform: z.enum(["ios", "android", "other"]).optional(),
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

/** Versão do jogo (header X-App-Version; versões antigas não mandam). */
function appVersion(request: FastifyRequest): string | undefined {
  const v = request.headers["x-app-version"];
  return typeof v === "string" && /^\d+(\.\d+){0,3}$/.test(v) ? v : undefined;
}

function playerIdOf(request: FastifyRequest): string {
  return request.user.sub;
}

export async function v1Routes(app: FastifyInstance, deps: V1Deps): Promise<void> {
  const { db, now, config } = deps;
  const links = linkConfig(config.GOOGLE_CLIENT_IDS, config.APPLE_AUDIENCES);
  const idKeys = deps.idKeys ?? remoteJwkResolver();
  const googlePlay = deps.googlePlay;

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

  // Versão sem dinheiro real / sem anúncios (ADR 0018); compras podem abrir por plataforma
  // (PURCHASES_PLATFORMS=ios — ADR 0022). A loja do recibo define a plataforma.
  const purchasesOn = async (request: FastifyRequest) => {
    const body = (request.body ?? {}) as { store?: string };
    const anyPlatform = config.PURCHASES_ENABLED || features.purchasePlatforms.length > 0;
    const ok = body.store
      ? purchasesFor(STORE_PLATFORM[body.store]) ||
        (body.store === "mock" && purchasesFor(undefined))
      : anyPlatform;
    if (!ok) {
      throw new AppError(409, "PURCHASES_DISABLED", "Compras ainda não disponíveis");
    }
  };
  // Anúncios podem abrir só no iPhone (ADS_PLATFORMS=ios). O resgate exige a sessão aberta
  // pelo /ads/start (e, com AdMob, a confirmação SSV do Google), então basta checar na abertura.
  const adsOn = async (request: FastifyRequest) => {
    const body = (request.body ?? {}) as { platform?: string; sessionId?: string };
    const ok = body.sessionId
      ? features.ads || features.adPlatforms.length > 0
      : adsFor(storePlatform(body.platform, appVersion(request)));
    if (!ok) throw new AppError(409, "ADS_DISABLED", "Anúncios ainda não disponíveis");
  };

  // Aviso de atualização (sem login): versão no ar na loja do aparelho e a mínima aceita. O jogo
  // compara com a sua e mostra "Atualizar" (ou obriga, abaixo da mínima).
  app.get("/app/version", async (request) => {
    const { platform } = z.object({ platform: z.enum(["ios", "android"]) }).parse(request.query);
    const live = deps.storeVersions ? await deps.storeVersions() : null;
    const minimum =
      (platform === "ios" ? config.MIN_APP_VERSION_IOS : config.MIN_APP_VERSION_ANDROID) || null;
    return {
      platform,
      latest: live ? live[platform].version : null,
      minimum,
      storeUrl: STORE_URLS[platform],
    };
  });

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

  // Contas vinculadas (ADR 0015) ------------------------------------------------
  app.post(
    "/auth/social",
    {
      config: { rateLimit: { max: config.RATE_LIMIT_AUTH_PER_MINUTE, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { provider, idToken } = IdentityBody.parse(request.body);
      const session = await signInWithIdentity(db, provider, idToken, links, idKeys, now());
      const accessToken = await reply.jwtSign(
        { sub: session.playerId },
        { expiresIn: config.JWT_EXPIRES_IN },
      );
      return {
        ...session,
        accessToken,
        tokenType: "Bearer",
        expiresIn: config.JWT_EXPIRES_IN,
      };
    },
  );

  app.get("/auth/identities", { preHandler: authenticate }, async (request) =>
    listIdentities(db, playerIdOf(request), links),
  );

  app.post("/auth/link", { preHandler: authenticate }, async (request) => {
    const { provider, idToken } = IdentityBody.parse(request.body);
    return linkIdentity(db, playerIdOf(request), provider, idToken, links, idKeys, now());
  });

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
    // `times`: toques rápidos no mesmo negócio viram um comando só (sobe até N níveis enquanto
    // houver saldo, numa transação) — nada se perde se o jogador sair logo depois.
    const { businessSlug, times } = BusinessBody.extend({
      times: z.number().int().min(1).max(100).optional(),
    }).parse(request.body);
    return command(request, reply, "businesses.upgrade", (at) =>
      upgradeBusiness(businessSlug, at, times ?? 1),
    );
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

  app.get("/leaderboard/stars", { preHandler: authenticate }, async (request) =>
    getStarsRanking(db, playerIdOf(request), now()),
  );

  // Pódio semanal (ADR 0017): prêmios de 1º/2º/3º lugar da semana anterior.
  app.get("/rewards/weekly", { preHandler: authenticate }, async (request) =>
    getWeeklyRewards(db, playerIdOf(request), now()),
  );

  app.post("/rewards/weekly/claim", { preHandler: authenticate }, async (request, reply) => {
    const { week, kind } = z
      .object({ week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), kind: z.enum(["semana", "liga"]) })
      .parse(request.body);
    return command(request, reply, "rewards.weekly", (at) => claimWeeklyReward(week, kind, at));
  });

  // --- Retenção (ADR 0014) ---------------------------------------------------

  app.get("/daily-reward", { preHandler: authenticate }, async (request) =>
    getDailyReward(db, playerIdOf(request), now()),
  );

  app.post("/daily-reward/claim", { preHandler: authenticate }, async (request, reply) =>
    command(request, reply, "daily.claim", (at) => claimDailyReward(at)),
  );

  app.post("/missions/chest", { preHandler: authenticate }, async (request, reply) =>
    command(request, reply, "missions.chest", (at) => claimMissionChest(at)),
  );

  app.get("/event", { preHandler: authenticate }, async (request) =>
    getEvent(db, playerIdOf(request), now()),
  );

  app.post("/event/claim", { preHandler: authenticate }, async (request, reply) =>
    command(request, reply, "event.claim", (at) => claimEvent(at)),
  );

  app.post("/analytics/events", { preHandler: authenticate }, async (request, reply) => {
    const { events } = EventsBody.parse(request.body);
    for (const e of events) await track(db, playerIdOf(request), e.name, e.props ?? {});
    return reply.code(202).send({ accepted: events.length });
  });

  // --- Loja, compras e anúncios (ADR 0008) ---------------------------------

  app.get("/store/catalog", { preHandler: authenticate }, async (request) => {
    const { district, platform } = z
      .object({
        district: Slug.optional(),
        platform: z.enum(["ios", "android", "other"]).optional(),
      })
      .parse(request.query);
    // O jogo pede o catálogo ao abrir: guarda aparelho e versão (painel admin por plataforma).
    // Só escreve quando muda (o NULL do banco não entra em "diferente de", daí as duas condições).
    const version = appVersion(request);
    if (platform === "ios" || platform === "android") {
      const changed: Prisma.PlayerWhereInput[] = [
        { platform: null },
        { platform: { not: platform } },
      ];
      if (version) changed.push({ appVersion: null }, { appVersion: { not: version } });
      await db.player.updateMany({
        where: { id: playerIdOf(request), OR: changed },
        data: { platform, ...(version ? { appVersion: version } : {}) },
      });
    }
    const catalog = await getCatalog(
      db,
      playerIdOf(request),
      now(),
      config.STORE_MODE,
      district,
      storePlatform(platform, appVersion(request)),
    );
    // "admob" = anúncio real com confirmação SSV do Google; "mock" = anúncio de teste.
    return { ...catalog, adsMode: config.ADS_MODE };
  });

  app.post("/vip/daily", { preHandler: authenticate }, async (request, reply) =>
    command(request, reply, "vip.daily", (at) => claimVipDaily(at)),
  );

  app.post("/players/report", { preHandler: authenticate }, async (request, reply) => {
    const { playerId } = z.object({ playerId: z.uuid() }).parse(request.body);
    reply.code(202);
    return reportPlayer(db, playerIdOf(request), playerId, now());
  });

  app.post("/player/name", { preHandler: authenticate }, async (request) => {
    const { displayName } = z.object({ displayName: z.string().max(60) }).parse(request.body);
    const at = now();
    await changeName(db, playerIdOf(request), displayName, at);
    return getPlayerState(db, playerIdOf(request), at);
  });

  // Exclusão de conta (LGPD, ADR 0009): irreversível; exige a confirmação digitada.
  // Prestígio — "Vender o império" (ADR 0011).
  app.get("/prestige", { preHandler: authenticate }, async (request) =>
    getPrestige(db, playerIdOf(request)),
  );

  app.post("/prestige", { preHandler: authenticate }, async (request, reply) =>
    command(request, reply, "prestige.sell", (at) => sellEmpire(config.STARTING_COINS, at)),
  );

  app.post("/player/delete", { preHandler: authenticate }, async (request) => {
    z.object({ confirm: z.literal("EXCLUIR") }).parse(request.body);
    await deleteAccount(db, playerIdOf(request));
    return { deleted: true };
  });

  app.post("/store/buy", { preHandler: authenticate }, async (request, reply) => {
    // `times`: toques rápidos no mesmo item viram um comando só (compra até N, parando no saldo).
    const { itemId, district, times } = BuyBody.extend({
      times: z.number().int().min(1).max(50).optional(),
    }).parse(request.body);
    return command(request, reply, "store.buy", (at) =>
      buyWithGems(itemId, district, at, times ?? 1),
    );
  });

  app.post(
    "/purchases/verify",
    { preHandler: [authenticate, purchasesOn], bodyLimit: 64 * 1024 },
    async (request, reply) => {
      const { store, productId, purchaseToken, district } = VerifyBody.parse(request.body);
      const verifier = verifierFor(store, {
        storeMode: config.STORE_MODE,
        appleBundleId: config.APPLE_BUNDLE_ID,
        now,
        appleRootFingerprint: deps.appleRootFingerprint,
        googlePlay,
      });
      return command(request, reply, "purchases.verify", (at) =>
        verifyPurchase(store, productId, purchaseToken, verifier, at, district),
      );
    },
  );

  app.post("/purchases/restore", { preHandler: [authenticate, purchasesOn] }, async (request) =>
    restorePurchases(db, playerIdOf(request), now()),
  );

  // App Store Server Notifications V2 (URL cadastrada na App Store Connect): estornos revogam.
  app.post(
    "/purchases/apple/notifications",
    // signedPayload traz um JWS com outros JWS dentro (transação e renovação): passa de 16 KB.
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } }, bodyLimit: 64 * 1024 },
    async (request) => {
      const { signedPayload } = z.object({ signedPayload: z.string().min(10) }).parse(request.body);
      return handleAppleNotification(db, signedPayload, now(), deps.appleRootFingerprint);
    },
  );

  const ssvKeys = deps.admobKeys ?? admobKeyResolver(config.ADMOB_KEYS_URL);

  app.post("/ads/start", { preHandler: [authenticate, adsOn] }, async (request, reply) => {
    const { placement, district } = AdStartBody.parse(request.body);
    return command(request, reply, "ads.start", (at) => startAd(placement, district, at));
  });

  app.post("/ads/claim", { preHandler: [authenticate, adsOn] }, async (request, reply) => {
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
