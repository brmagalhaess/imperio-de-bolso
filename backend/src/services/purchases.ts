import type { Db, Tx } from "../db/prisma.js";
import { AppError } from "../errors.js";
import { createHash } from "node:crypto";
import { AppleJwsError, verifyAppleJws } from "../lib/apple-jws.js";
import { GooglePlayError, type GooglePlayApi } from "../lib/google-play.js";
import { bundleByProductId } from "../economy/bundles.js";
import { itemByProductId } from "../economy/store.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { track } from "./analytics.js";
import { getPlayerState } from "./game.js";
import { grantBundle } from "./bundles.js";
import { applyGems } from "./wallet.js";

// Compras com dinheiro real (doc §12, plano §23, ADR 0008). O servidor é a autoridade:
// verifica a transação com a loja, grava o recibo (único por loja+transação) e concede o item.
// Reembolso/estorno revoga o benefício. Em desenvolvimento só existe o provedor "mock".

export type StoreName = "mock" | "google" | "apple";

export interface VerifiedTransaction {
  transactionId: string;
  productId: string;
  /** Fim do período pago da assinatura informado pela loja (senão, conta pelos dias do item). */
  expiresAt?: Date;
  /** Sem cobrança (Sandbox da Apple, testador do Google, mock): fora das estatísticas. */
  test?: boolean;
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
    return { transactionId: purchaseToken, productId, test: true };
  },
};

/**
 * Apple StoreKit 2: o jogo manda o `jwsRepresentation` da transação. O servidor confere a
 * assinatura da Apple (lib/apple-jws.ts), o app (bundle id), o produto e se não foi estornada.
 * Transações do ambiente Sandbox são aceitas: a revisão da Apple compra em Sandbox no app de
 * produção (não há cobrança real nelas).
 */
export function appleVerifier(
  bundleId: string,
  now: () => Date,
  rootFingerprint?: string,
): StoreVerifier {
  return {
    async verify(productId, purchaseToken) {
      const at = now();
      const t = decodeAppleTransaction(purchaseToken, at, rootFingerprint);
      if (t.bundleId !== bundleId) {
        throw new AppError(422, "PURCHASE_INVALID", "Recibo de outro app");
      }
      if (t.productId !== productId) {
        throw new AppError(422, "PURCHASE_INVALID", "Recibo não corresponde ao produto");
      }
      if (t.revocationDate) {
        throw new AppError(422, "PURCHASE_REVOKED", "Compra estornada");
      }
      if (t.expiresAt && t.expiresAt <= at) {
        throw new AppError(422, "PURCHASE_EXPIRED", "Assinatura vencida");
      }
      return {
        transactionId: t.transactionId,
        productId: t.productId,
        expiresAt: t.expiresAt,
        test: t.environment !== "Production",
      };
    },
  };
}

export interface AppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  environment: string;
  expiresAt?: Date;
  revocationDate?: Date;
}

/** Confere e lê um JWSTransaction da App Store. */
export function decodeAppleTransaction(
  jws: string,
  now: Date,
  rootFingerprint?: string,
): AppleTransaction {
  let p: Record<string, unknown>;
  try {
    p = verifyAppleJws(jws, { now, rootFingerprint });
  } catch (e) {
    if (e instanceof AppleJwsError) throw new AppError(422, "PURCHASE_INVALID", e.message);
    throw e;
  }
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
  const date = (v: unknown) => (typeof v === "number" ? new Date(v) : undefined);
  if (!str(p.transactionId) || !str(p.productId)) {
    throw new AppError(422, "PURCHASE_INVALID", "Recibo incompleto");
  }
  return {
    transactionId: str(p.transactionId),
    originalTransactionId: str(p.originalTransactionId),
    bundleId: str(p.bundleId),
    productId: str(p.productId),
    environment: str(p.environment),
    expiresAt: date(p.expiresDate),
    revocationDate: date(p.revocationDate),
  };
}

/** Loja sem verificação configurada (ex.: Google sem a conta de serviço no servidor). */
const notConfigured = (store: string): StoreVerifier => ({
  async verify() {
    throw new AppError(
      501,
      "STORE_NOT_CONFIGURED",
      `Verificação da loja ${store} ainda não configurada`,
    );
  },
});

/** Assinatura do Google com direito ativo (cancelada = só não renova; vale até o fim). */
const GOOGLE_ACTIVE_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  "SUBSCRIPTION_STATE_CANCELED",
]);

/**
 * Google Play Billing: o jogo manda o purchaseToken; o servidor consulta a compra na API do
 * Google Play (conta de serviço) e confere produto, estado e validade. A transação é o número
 * do pedido (orderId; cada renovação da assinatura gera um novo). Compras de testadores
 * licenciados (sem cobrança) também são aceitas, como o Sandbox da Apple.
 */
export function googleVerifier(api: GooglePlayApi, now: () => Date): StoreVerifier {
  const call = async <T>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof GooglePlayError) {
        throw new AppError(503, "STORE_UNAVAILABLE", "Google Play indisponível, tente de novo");
      }
      throw e;
    }
  };
  const tokenId = (token: string) =>
    `token:${createHash("sha256").update(token).digest("hex").slice(0, 40)}`;
  return {
    async verify(productId, purchaseToken) {
      if (itemByProductId(productId)?.kind === "subscription") {
        const s = await call(() => api.subscription(purchaseToken));
        const line = s?.lineItems?.find((l) => l.productId === productId);
        if (!s || !line)
          throw new AppError(422, "PURCHASE_INVALID", "Recibo não corresponde ao produto");
        const expiresAt = line.expiryTime ? new Date(line.expiryTime) : undefined;
        if (s.subscriptionState === "SUBSCRIPTION_STATE_PENDING") {
          throw new AppError(422, "PURCHASE_PENDING", "Pagamento pendente");
        }
        if (
          !GOOGLE_ACTIVE_STATES.has(s.subscriptionState ?? "") ||
          !expiresAt ||
          expiresAt <= now()
        ) {
          throw new AppError(422, "PURCHASE_EXPIRED", "Assinatura vencida");
        }
        return {
          transactionId: s.latestOrderId ?? tokenId(purchaseToken),
          productId,
          expiresAt,
          test: s.testPurchase !== undefined,
        };
      }
      const p = await call(() => api.product(productId, purchaseToken));
      if (!p || (p.productId && p.productId !== productId)) {
        throw new AppError(422, "PURCHASE_INVALID", "Recibo inválido");
      }
      if (p.purchaseState === 1) throw new AppError(422, "PURCHASE_REVOKED", "Compra cancelada");
      if (p.purchaseState === 2) throw new AppError(422, "PURCHASE_PENDING", "Pagamento pendente");
      return {
        transactionId: p.orderId || tokenId(purchaseToken),
        productId,
        test: p.purchaseType === 0,
      };
    },
  };
}

export interface VerifierDeps {
  storeMode: string;
  appleBundleId: string;
  now: () => Date;
  /** Testes: raiz própria no lugar da Apple Root CA - G3. */
  appleRootFingerprint?: string;
  /** API do Google Play (conta de serviço); ausente = verificação do Google desligada. */
  googlePlay?: GooglePlayApi;
}

export function verifierFor(store: StoreName, deps: VerifierDeps): StoreVerifier {
  if (store === "mock") {
    if (deps.storeMode !== "mock")
      throw new AppError(403, "MOCK_DISABLED", "Compras de teste desligadas");
    return mockVerifier;
  }
  if (store === "apple")
    return appleVerifier(deps.appleBundleId, deps.now, deps.appleRootFingerprint);
  if (store === "google" && deps.googlePlay) return googleVerifier(deps.googlePlay, deps.now);
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
  district?: string,
) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    // Pacote promocional (ADR 0024) ou item avulso da Loja (diamantes / Passe VIP).
    const bundle = bundleByProductId(productId);
    const found = bundle ? undefined : itemByProductId(productId);
    const item = bundle
      ? { kind: "bundle" as const, id: bundle.id }
      : found && (found.kind === "iap" || found.kind === "subscription" || found.kind === "double")
        ? found
        : undefined;
    if (!item) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Produto não encontrado", { productId });
    }
    const tr = await verifier.verify(productId, purchaseToken);
    if (tr.productId !== productId) {
      throw new AppError(422, "PURCHASE_INVALID", "Recibo não corresponde ao produto");
    }
    const existing = await tx.purchaseReceipt.findUnique({
      where: { store_transactionId: { store, transactionId: tr.transactionId } },
    });
    if (existing && existing.playerId === null && item.kind === "subscription") {
      // Assinatura de uma conta excluída (ADR 0009): a pessoa ainda paga na loja, então
      // "restaurar" religa o direito à conta atual. Diamantes já entregues não voltam.
      await tx.purchaseReceipt.update({
        where: { id: existing.id },
        data: { playerId: wallet.playerId },
      });
      await tx.subscription.updateMany({
        where: { store, transactionId: tr.transactionId, playerId: null },
        data: { playerId: wallet.playerId },
      });
      await track(tx, wallet.playerId, "subscription_relinked", { product: item.id, store });
      return {
        statusCode: 200,
        body: {
          relinked: true,
          receipt: existing.id,
          state: await getPlayerState(tx, wallet.playerId, now),
        },
      };
    }
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
    let coins = 0n;
    if (item.kind === "double") {
      // Dobro de moedas (ADR 0025): soma horas à validade; o limite de 3/mês é da vitrine — o
      // pagamento já foi feito na loja, então a entrega nunca é recusada.
      const p = await tx.player.findUniqueOrThrow({ where: { id: wallet.playerId } });
      const active = p.doubleUntil && p.doubleUntil > now;
      await tx.player.update({
        where: { id: wallet.playerId },
        data: {
          doubleFrom: active ? p.doubleFrom : now,
          doubleUntil: new Date(
            (active ? p.doubleUntil!.getTime() : now.getTime()) + item.hours * 3_600_000,
          ),
        },
      });
    } else if (item.kind === "bundle") {
      gems = bundle!.gems;
      coins = (await grantBundle(tx, wallet, bundle!, district, idempotencyKey, now)).coins;
    } else if (item.kind === "iap") {
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
          test: tr.test ?? false,
          startsAt,
          // A loja informa o fim do período (renovação mensal da Apple); o mock soma os dias.
          expiresAt: tr.expiresAt ?? new Date(startsAt.getTime() + item.periodDays * DAY_MS),
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
        test: tr.test ?? false,
        gemsGranted: gems,
        createdAt: now, // relógio do servidor (vitrine semanal dos pacotes compara com ele)
      },
    });
    await track(tx, wallet.playerId, "purchase_verified", { product: item.id, store });
    return {
      statusCode: 201,
      body: {
        receipt: receipt.id,
        product: item.id,
        gems: gems.toString(),
        ...(coins > 0n ? { coins: coins.toString() } : {}),
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
    if (r.gemsGranted > 0n && r.playerId === null) {
      // Conta já excluída: não há saldo para retirar; registra o total como falta.
      shortfall = r.gemsGranted;
    } else if (r.gemsGranted > 0n && r.playerId !== null) {
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

/**
 * App Store Server Notifications V2 (estorno/revogação). A Apple manda `signedPayload` assinado;
 * REFUND e REVOKE revogam o benefício da transação. O resto só é registrado.
 */
export async function handleAppleNotification(
  db: Db,
  signedPayload: string,
  now: Date,
  rootFingerprint?: string,
): Promise<{ type: string; revoked: boolean }> {
  let n: Record<string, unknown>;
  try {
    n = verifyAppleJws(signedPayload, { now, rootFingerprint });
  } catch (e) {
    if (e instanceof AppleJwsError) throw new AppError(422, "NOTIFICATION_INVALID", e.message);
    throw e;
  }
  const type = String(n.notificationType ?? "");
  const data = (n.data ?? {}) as Record<string, unknown>;
  if ((type === "REFUND" || type === "REVOKE") && typeof data.signedTransactionInfo === "string") {
    const t = decodeAppleTransaction(data.signedTransactionInfo, now, rootFingerprint);
    try {
      await revokePurchase(db, "apple", t.transactionId, now);
      return { type, revoked: true };
    } catch (e) {
      if (e instanceof AppError && e.code === "PURCHASE_NOT_FOUND") return { type, revoked: false };
      throw e;
    }
  }
  await track(db, null, "apple_notification", { type });
  return { type, revoked: false };
}
