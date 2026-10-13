import { createHash } from "node:crypto";
import type { Db, Tx } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { lockWallet, type LockedWallet } from "../services/wallet.js";

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function parseIdempotencyKey(header: string | string[] | undefined): string {
  const key = Array.isArray(header) ? header[0] : header;
  if (!key || !KEY_PATTERN.test(key)) throw Errors.idempotencyKeyRequired();
  return key;
}

export interface CommandResult {
  statusCode: number;
  body: unknown;
}

export interface CommandContext {
  tx: Tx;
  wallet: LockedWallet;
  idempotencyKey: string;
}

function hashRequest(route: string, body: unknown): string {
  return createHash("sha256")
    .update(route)
    .update("\n")
    .update(JSON.stringify(body ?? null))
    .digest("hex");
}

/**
 * Executa um comando econômico numa transação, com a carteira travada, e grava
 * a resposta sob (jogador, Idempotency-Key). Reenvio com a mesma chave devolve
 * a resposta gravada sem reexecutar; chave reaproveitada com outro corpo → 422.
 *
 * Como a carteira é travada antes da consulta, duas requisições simultâneas com
 * a mesma chave são serializadas: a segunda já enxerga o registro da primeira.
 * Erros de domínio não são gravados (não alteram estado) e podem ser repetidos.
 */
export async function runIdempotentCommand(
  db: Db,
  args: { playerId: string; key: string; route: string; body: unknown },
  command: (ctx: CommandContext) => Promise<CommandResult>,
): Promise<CommandResult> {
  const requestHash = hashRequest(args.route, args.body);

  return db.$transaction(
    async (tx) => {
      const wallet = await lockWallet(tx, args.playerId);

      const existing = await tx.idempotencyRecord.findUnique({
        where: { playerId_key: { playerId: args.playerId, key: args.key } },
      });
      if (existing) {
        if (existing.requestHash !== requestHash) throw Errors.idempotencyKeyReused();
        return { statusCode: existing.statusCode, body: existing.responseBody };
      }

      const result = await command({ tx, wallet, idempotencyKey: args.key });

      await tx.idempotencyRecord.create({
        data: {
          playerId: args.playerId,
          key: args.key,
          route: args.route,
          requestHash,
          statusCode: result.statusCode,
          responseBody: result.body as object,
        },
      });
      return result;
    },
    { isolationLevel: "ReadCommitted", maxWait: 5_000, timeout: 10_000 },
  );
}
