import type { Tx } from "../db/prisma.js";
import { AppError, Errors } from "../errors.js";

/** Maior saldo de moedas possível (cabe com folga em 9,22×10^18). */
export const MAX_COINS = 9_000_000_000_000_000_000n;

export interface LockedWallet {
  playerId: string;
  coins: bigint;
  gems: bigint;
  version: number;
}

/**
 * Trava a carteira do jogador (SELECT … FOR UPDATE) até o fim da transação.
 * Todo comando econômico começa por aqui: uma única ordem de lock por jogador
 * serializa compras/upgrades/coletas concorrentes e evita deadlocks.
 */
export async function lockWallet(tx: Tx, playerId: string): Promise<LockedWallet> {
  const rows = await tx.$queryRaw<LockedWallet[]>`
    SELECT player_id AS "playerId", coins, gems, version
    FROM player_wallets
    WHERE player_id = ${playerId}::uuid
    FOR UPDATE`;
  const wallet = rows[0];
  if (!wallet) throw Errors.unauthorized();
  return { ...wallet, coins: BigInt(wallet.coins), gems: BigInt(wallet.gems) };
}

/**
 * Aplica um delta de moedas na carteira travada e registra no ledger.
 * `ledgerKey` é único globalmente: repetir a mesma chave falha em vez de duplicar.
 */
export async function applyCoins(
  tx: Tx,
  wallet: LockedWallet,
  delta: bigint,
  reason: string,
  ledgerKey: string,
  /** Relógio do servidor (o mesmo das regras); padrão: agora. */
  at: Date = new Date(),
): Promise<LockedWallet> {
  // Teto do saldo (BIGINT do banco e int64 do jogo): ganhos acima disso são descartados.
  if (delta > 0n && wallet.coins + delta > MAX_COINS) delta = MAX_COINS - wallet.coins;
  const balanceAfter = wallet.coins + delta;
  if (balanceAfter < 0n) throw Errors.insufficientFunds(-delta, wallet.coins);

  const updated = await tx.playerWallet.updateMany({
    where: { playerId: wallet.playerId, version: wallet.version },
    data: { coins: balanceAfter, version: { increment: 1 } },
  });
  if (updated.count !== 1) {
    // Não deveria acontecer com o FOR UPDATE; protege contra uso sem lock.
    throw new AppError(409, "CONCURRENT_UPDATE", "Carteira alterada por outra operação");
  }

  await tx.walletLedger.create({
    data: {
      playerId: wallet.playerId,
      currency: "COINS",
      delta,
      balanceAfter,
      reason,
      idempotencyKey: `${wallet.playerId}:${ledgerKey}`,
      createdAt: at,
    },
  });

  return { ...wallet, coins: balanceAfter, version: wallet.version + 1 };
}

/** Igual a applyCoins, para diamantes (moeda premium com fontes gratuitas — doc §6). */
export async function applyGems(
  tx: Tx,
  wallet: LockedWallet,
  delta: bigint,
  reason: string,
  ledgerKey: string,
  /** Relógio do servidor (o mesmo das regras); padrão: agora. */
  at: Date = new Date(),
): Promise<LockedWallet> {
  const balanceAfter = wallet.gems + delta;
  if (balanceAfter < 0n) throw Errors.insufficientFunds(-delta, wallet.gems);
  const updated = await tx.playerWallet.updateMany({
    where: { playerId: wallet.playerId, version: wallet.version },
    data: { gems: balanceAfter, version: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new AppError(409, "CONCURRENT_UPDATE", "Carteira alterada por outra operação");
  }
  await tx.walletLedger.create({
    data: {
      playerId: wallet.playerId,
      currency: "GEMS",
      delta,
      balanceAfter,
      reason,
      idempotencyKey: `${wallet.playerId}:${ledgerKey}`,
      createdAt: at,
    },
  });
  return { ...wallet, gems: balanceAfter, version: wallet.version + 1 };
}
