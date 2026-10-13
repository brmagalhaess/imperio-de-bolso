import type { Tx } from "../db/prisma.js";
import { AppError, Errors } from "../errors.js";

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
): Promise<LockedWallet> {
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
    },
  });

  return { ...wallet, coins: balanceAfter, version: wallet.version + 1 };
}
