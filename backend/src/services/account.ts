import type { Db, Tx } from "../db/prisma.js";
import { track } from "./analytics.js";

/**
 * Exclusão de conta (LGPD; ADR 0009). Apaga o jogador e todos os dados de jogo (carteira,
 * ledger, negócios, missões, conquistas, anúncios, idempotência e eventos de analytics).
 * Recibos de compra e assinaturas ficam desvinculados (player_id nulo, sem dado pessoal) para
 * impedir reuso do mesmo recibo e para processar reembolsos das lojas.
 */
export async function deleteAccount(db: Db, playerId: string): Promise<void> {
  await db.$transaction(async (tx: Tx) => {
    // Espera comandos em andamento desta conta terminarem (mesma trava da carteira).
    await tx.$queryRaw`SELECT 1 FROM player_wallets WHERE player_id = ${playerId}::uuid FOR UPDATE`;
    await tx.analyticsEvent.deleteMany({ where: { playerId } });
    await tx.player.delete({ where: { id: playerId } });
    // Só a contagem agregada, sem identificar quem saiu.
    await track(tx, null, "account_deleted");
  });
}
