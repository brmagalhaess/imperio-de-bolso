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
import { createGuest, resumeGuest } from "../services/auth.js";
import {
  collectProduction,
  getPlayerState,
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
}
