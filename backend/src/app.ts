import fastifyHelmet from "@fastify/helmet";
import { setFeatures } from "./lib/features.js";
import fastifyJwt from "@fastify/jwt";
import fastifyRateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { AppConfig } from "./config.js";
import type { Db } from "./db/prisma.js";
import { AppError } from "./errors.js";
import { adminRoutes } from "./routes/admin.js";
import { v1Routes } from "./routes/v1.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

export interface AppDeps {
  config: AppConfig;
  db: Db;
  /** Relógio do servidor; injetável para testes de tempo. */
  now?: () => Date;
  logger?: boolean;
  /** Chaves do SSV do AdMob (testes injetam as suas). */
  admobKeys?: import("./lib/admob-ssv.js").KeyResolver;
  idKeys?: import("./lib/id-token.js").JwkResolver;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  setFeatures({ purchases: deps.config.PURCHASES_ENABLED, ads: deps.config.ADS_ENABLED });
  const app = Fastify({
    trustProxy: deps.config.TRUST_PROXY,
    // Logs sem dados sensíveis (plano §28): nada de corpo, cabeçalho Authorization ou query.
    logger: deps.logger
      ? {
          serializers: {
            req: (req) => ({ method: req.method, url: (req.url ?? "").split("?")[0] }),
          },
        }
      : false,
    bodyLimit: 16 * 1024,
  });
  const now = deps.now ?? (() => new Date());

  // Corpo vazio com content-type JSON vira {} em vez de erro.
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    const text = typeof body === "string" ? body : body.toString("utf8");
    if (text.trim() === "") return done(null, {});
    try {
      done(null, JSON.parse(text));
    } catch {
      done(new AppError(400, "INVALID_JSON", "JSON inválido"), undefined);
    }
  });

  await app.register(fastifyJwt, { secret: deps.config.JWT_SECRET });
  // Cabeçalhos de segurança (API JSON: sem CSP de página).
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await app.register(fastifyRateLimit, {
    max: deps.config.RATE_LIMIT_PER_MINUTE,
    timeWindow: "1 minute",
    allowList: (req) => req.url === "/health",
    // Vira AppError para sair no formato padrão { error: { code, message, details } }.
    errorResponseBuilder: (_req, ctx) =>
      new AppError(429, "RATE_LIMITED", "Muitas requisições. Tente de novo em instantes.", {
        retryAfterSeconds: Math.ceil(ctx.ttl / 1000),
      }),
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Requisição inválida",
          details: { issues: error.issues.map((i) => ({ path: i.path, message: i.message })) },
        },
      });
    }
    const { statusCode, message } = error as { statusCode?: number; message?: string };
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({ error: { code: "BAD_REQUEST", message } });
    }
    request.log.error({ err: error }, "erro inesperado");
    return reply
      .code(500)
      .send({ error: { code: "INTERNAL_ERROR", message: "Erro interno, tente novamente" } });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Rota não encontrada" } }),
  );

  app.get("/health", async () => {
    await deps.db.$queryRaw`SELECT 1`;
    return { status: "ok", serverTime: now().toISOString() };
  });

  await app.register(
    (instance) =>
      v1Routes(instance, {
        config: deps.config,
        db: deps.db,
        now,
        admobKeys: deps.admobKeys,
        idKeys: deps.idKeys,
      }),
    {
      prefix: "/api/v1",
    },
  );

  const adminToken = deps.config.ADMIN_TOKEN;
  if (adminToken) {
    await app.register(
      (instance) => adminRoutes(instance, { db: deps.db, token: adminToken, now }),
      {
        prefix: "/api/admin",
      },
    );
  }

  return app;
}
