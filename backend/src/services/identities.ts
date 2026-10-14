import { createHash, randomBytes } from "node:crypto";
import type { Db } from "../db/prisma.js";
import { AppError } from "../errors.js";
import { type JwkResolver, type Provider, IdTokenError, verifyIdToken } from "../lib/id-token.js";
import { track } from "./analytics.js";

// Contas vinculadas (ADR 0015): a conta convidada continua sendo a conta; vincular ao
// Google/Apple guarda só o id estável do usuário no provedor. Em outro aparelho, entrar com o
// mesmo Google/Apple recupera o progresso (gera um segredo novo de convidado para o aparelho).

export interface LinkConfig {
  google: string[];
  apple: string[];
}

export function linkConfig(googleIds: string, appleAudiences: string): LinkConfig {
  const list = (v: string) =>
    v
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  return { google: list(googleIds), apple: list(appleAudiences) };
}

async function subjectOf(
  provider: Provider,
  idToken: string,
  cfg: LinkConfig,
  keys: JwkResolver,
  now: Date,
): Promise<string> {
  const audiences = cfg[provider];
  if (audiences.length === 0) {
    throw new AppError(503, "LINK_NOT_CONFIGURED", "Vínculo de conta ainda não disponível");
  }
  try {
    return (await verifyIdToken(provider, idToken, audiences, keys, now)).sub;
  } catch (e) {
    if (e instanceof IdTokenError) throw new AppError(401, "INVALID_ID_TOKEN", e.message);
    throw e;
  }
}

export async function listIdentities(db: Db, playerId: string, cfg: LinkConfig) {
  const rows = await db.playerIdentity.findMany({ where: { playerId } });
  return {
    linked: rows.map((r) => r.provider),
    available: (["google", "apple"] as const).filter((p) => cfg[p].length > 0),
  };
}

/** Vincula a conta atual ao Google/Apple. */
export async function linkIdentity(
  db: Db,
  playerId: string,
  provider: Provider,
  idToken: string,
  cfg: LinkConfig,
  keys: JwkResolver,
  now: Date,
) {
  const subject = await subjectOf(provider, idToken, cfg, keys, now);
  const existing = await db.playerIdentity.findUnique({
    where: { provider_subject: { provider, subject } },
  });
  if (existing && existing.playerId !== playerId) {
    throw new AppError(409, "IDENTITY_IN_USE", "Essa conta já está ligada a outro progresso");
  }
  if (!existing) {
    const mine = await db.playerIdentity.findUnique({
      where: { playerId_provider: { playerId, provider } },
    });
    if (mine) throw new AppError(409, "ALREADY_LINKED", "Este progresso já tem uma conta ligada");
    await db.playerIdentity.create({ data: { provider, subject, playerId } });
    await track(db, playerId, "account_linked", { provider });
  }
  return listIdentities(db, playerId, cfg);
}

/**
 * Entrar com Google/Apple num aparelho novo: devolve a conta ligada com um segredo novo de
 * convidado (o aparelho antigo deixa de entrar sozinho — evita duas cópias jogando).
 */
export async function signInWithIdentity(
  db: Db,
  provider: Provider,
  idToken: string,
  cfg: LinkConfig,
  keys: JwkResolver,
  now: Date,
) {
  const subject = await subjectOf(provider, idToken, cfg, keys, now);
  const identity = await db.playerIdentity.findUnique({
    where: { provider_subject: { provider, subject } },
    include: { player: true },
  });
  if (!identity) {
    throw new AppError(404, "IDENTITY_NOT_FOUND", "Nenhum progresso ligado a essa conta");
  }
  const guestSecret = randomBytes(32).toString("base64url");
  await db.player.update({
    where: { id: identity.playerId },
    data: { guestSecretHash: createHash("sha256").update(guestSecret).digest("hex") },
  });
  await track(db, identity.playerId, "account_signed_in", { provider });
  return { playerId: identity.playerId, guestId: identity.player.guestId, guestSecret };
}
