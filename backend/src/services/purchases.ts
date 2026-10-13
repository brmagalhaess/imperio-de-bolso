import type { Db, Tx } from "../db/prisma.js";
import { AppError } from "../errors.js";
import { itemByProductId } from "../economy/store.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { track } from "./analytics.js";
import { getPlayerState } from "./game.js";
import { applyGems } from "./wallet.js";

// Compras com dinheiro real (doc §12, plano §23, ADR 0008). O servidor é a autoridade:
// verifica a transação com a loja, grava o recibo (único por loja+transação) e concede o item.
// Reembolso/estorno revoga o benefício. Em desenvolvimento só existe o provedor "mock".

export type StoreName = "mock" | "google" | "apple";

export interface VerifiedTransaction {
  transactionId: string;
  productId: string;
}

export interface StoreVerifier {
  verify(productId: string, purchaseToken: string): Promise<VerifiedTransaction>;
}

/** Simulação para desenvolvimento: aceita tokens "mock-…"; nenhum valor é cobrado. */
export const mockVerifier: StoreVerifier = {
  async verify(productId, purchaseToken) {
    if (!purchaseToken.startsWith("mock-")) {
      throw new AppError(422, "PURCHASE_INVALID", "Recibo de teste inválido");
    }
    return { transactionId: purchaseToken, productId };
  },
};

/**
 * Google Play Billing / Apple StoreKit 2: dependem de contas e credenciais ainda não criadas
 * (Play Console, App Store Connect). Bloqueio explícito em vez de API inventada — ADR 0008.
 */
const notConfigured = (store: string): StoreVerifier => ({
  async verify() {
    throw new AppError(
      501,
      "STORE_NOT_CONFIGURED",
      `Verificação da loja ${store} ainda não configurada`,
    );
  },
});

export function verifierFor(store: StoreName, storeMode: string): StoreVerifier {
  if (store === "mock") {
    if (storeMode !== "mock")
      throw new AppError(403, "MOCK_DISABLED", "Compras de teste desligadas");
    return mockVerifier;
  }
  return notConfigured(store);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Verifica e concede uma compra. Recibo repetido (mesma loja+transação) não concede de novo. */
export function verifyPurchase(
  store: StoreName,
  productId: string,
  purchaseToken: string,
  verifier: StoreVerifier,
  now: Date,
) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const item = itemByProductId(productId);
    if (!item || (item.kind !== "iap" && item.kind !== "subscription")) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Produto não encontrado", { productId });
    }
    const tr = await verifier.verify(productId, purchaseToken);
    if (tr.productId !== productId) {
      throw new AppError(422, "PURCHASE_INVALID", "Recibo não corresponde ao produto");
    }
    const existing = await tx.purchaseReceipt.findUnique({
      where: { store_transactionId: { store, transactionId: tr.transactionId } },
    });
    if (existing) {
      if (existing.playerId !== wallet.playerId) {
        throw new AppError(409, "PURCHASE_OWNED_BY_OTHER", "Recibo pertence a outra conta");
      }
      return {
        statusCode: 200,
        body: {
          duplicate: true,
          receipt: existing.id,
          state: await getPlayerState(tx, wallet.playerId, now),
        },
      };
    }

    let gems = 0n;
    if (item.kind === "iap") {
      gems = item.gems;
      await applyGems(tx, wallet, gems, `purchase:${item.id}`, idempotencyKey, now);
    } else {
      const last = await tx.subscription.findFirst({
        where: { playerId: wallet.playerId, productId, status: "ACTIVE", expiresAt: { gt: now } },
        orderBy: { expiresAt: "desc" },
      });
      const startsAt = last?.expiresAt ?? now;
      await tx.subscription.create({
        data: {
          playerId: wallet.playerId,
          productId,
          store,
          transactionId: tr.transactionId,
          status: "ACTIVE",
          startsAt,
          expiresAt: new Date(startsAt.getTime() + item.periodDays * DAY_MS),
        },
      });
    }
    const receipt = await tx.purchaseReceipt.create({
      data: {
        playerId: wallet.playerId,
        store,
        transactionId: tr.transactionId,
        productId,
        status: "VERIFIED",
        gemsGranted: gems,
      },
    });
    await track(tx, wallet.playerId, "purchase_verified", { product: item.id, store });
    return {
      statusCode: 201,
      body: {
        receipt: receipt.id,
        product: item.id,
        gems: gems.toString(),
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}

/**
 * Reembolso/estorno/cancelamento pela loja: revoga o benefício. Diamantes já gastos não ficam
 * negativos — o que faltou fica registrado em `revokeShortfall` para análise/antifraude.
 */
export async function revokePurchase(db: Db, store: StoreName, transactionId: string, now: Date) {
  return db.$transaction(async (tx: Tx) => {
    const r = await tx.purchaseReceipt.findUnique({
      where: { store_transactionId: { store, transactionId } },
    });
    if (!r) throw new AppError(404, "PURCHASE_NOT_FOUND", "Compra não encontrada");
    if (r.status === "REVOKED")
      return { alreadyRevoked: true, shortfall: r.revokeShortfall.toString() };

    let shortfall = 0n;
    if (r.gemsGranted > 0n) {
      const [w] = await tx.$queryRaw<{ gems: bigint; version: number }[]>`
        SELECT gems, version FROM player_wallets WHERE player_id = ${r.playerId}::uuid FOR UPDATE`;
      const take = w!.gems < r.gemsGranted ? w!.gems : r.gemsGranted;
      shortfall = r.gemsGranted - take;
      if (take > 0n) {
        await applyGems(
          tx,
          { playerId: r.playerId, coins: 0n, gems: w!.gems, version: w!.version },
          -take,
          `refund:${r.productId}`,
          `refund:${store}:${transactionId}`,
          now,
        );
      }
    }
    await tx.subscription.updateMany({
      where: { store, transactionId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: now },
    });
    await tx.purchaseReceipt.update({
      where: { id: r.id },
      data: { status: "REVOKED", revokedAt: now, revokeShortfall: shortfall },
    });
    await track(tx, r.playerId, "purchase_revoked", { product: r.productId, store });
    return { alreadyRevoked: false, shortfall: shortfall.toString() };
  });
}

/** Restaurar compras: o servidor guarda tudo por conta; devolve os direitos ativos. */
export async function restorePurchases(db: Db, playerId: string, now: Date) {
  const [receipts, subs] = await Promise.all([
    db.purchaseReceipt.findMany({ where: { playerId }, orderBy: { createdAt: "desc" } }),
    db.subscription.findMany({ where: { playerId, status: "ACTIVE", expiresAt: { gt: now } } }),
  ]);
  return {
    purchases: receipts.map((r) => ({
      product: r.productId,
      store: r.store,
      status: r.status,
      at: r.createdAt.toISOString(),
    })),
    activeSubscriptions: subs.map((s) => ({
      product: s.productId,
      expiresAt: s.expiresAt.toISOString(),
    })),
  };
}
