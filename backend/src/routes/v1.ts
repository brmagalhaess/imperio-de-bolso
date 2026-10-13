import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { Db } from "../db/prisma.js";
import { Errors } from "../errors.js";
import {
  parseIdempotencyKey,
  runIdempotentCommand,
  type CommandResult,
} from "../lib/idempotency.js";
import { CLIENT_EVENTS, track } from "../services/analytics.js";
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
  };

  app.post("/auth/guest", async (request, reply) => {
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
}
