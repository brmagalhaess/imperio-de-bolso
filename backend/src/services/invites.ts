import type { Db } from "../db/prisma.js";
import { AppError } from "../errors.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { track } from "./analytics.js";
import { getPlayerState } from "./game.js";
import { applyGems } from "./wallet.js";

// Convide amigos (ADR 0035). O código de convite é o código do jogador (8 primeiros caracteres
// do id, o mesmo do suporte). Quem usa um código ganha diamantes na hora; quem convidou ganha
// quando o amigo joga de verdade (chega a INVITE_STARS estrelas de evolução) — conta falsa
// parada não rende nada. Cada jogador usa um código só, uma vez.

export const INVITE_GUEST_GEMS = 20;
export const INVITE_HOST_GEMS = 40;
/** Estrelas de evolução que o amigo precisa ter para o convite render a quem convidou. */
export const INVITE_STARS = 20;
/** Convites premiados por jogador (teto contra fazenda de contas). */
export const INVITE_MAX_REWARDED = 20;

const CODE = /^[0-9a-f]{8}$/i;
export const inviteCode = (playerId: string) => playerId.slice(0, 8).toUpperCase();

export async function getInvites(db: Db, playerId: string) {
  const [me, friends] = await Promise.all([
    db.player.findUniqueOrThrow({ where: { id: playerId }, select: { invitedBy: true } }),
    db.player.findMany({
      where: { invitedBy: playerId },
      select: { evoStars: true, inviteRewardedAt: true },
    }),
  ]);
  const rewarded = friends.filter((f) => f.inviteRewardedAt !== null).length;
  const ready = friends.filter(
    (f) => f.inviteRewardedAt === null && (f.evoStars ?? 0) >= INVITE_STARS,
  ).length;
  const claimable = Math.max(0, Math.min(ready, INVITE_MAX_REWARDED - rewarded));
  return {
    code: inviteCode(playerId),
    canRedeem: me.invitedBy === null,
    friends: friends.length,
    rewarded,
    claimable,
    claimableGems: claimable * INVITE_HOST_GEMS,
    guestGems: INVITE_GUEST_GEMS,
    hostGems: INVITE_HOST_GEMS,
    stars: INVITE_STARS,
    maxRewarded: INVITE_MAX_REWARDED,
  };
}

/** Usa o código de um amigo: diamantes na hora para quem usa. */
export function redeemInvite(code: string, now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    if (!CODE.test(code)) throw new AppError(400, "INVITE_INVALID", "Código inválido");
    const me = await tx.player.findUniqueOrThrow({ where: { id: wallet.playerId } });
    if (me.invitedBy) throw new AppError(409, "INVITE_ALREADY_USED", "Você já usou um código");
    const hosts = await tx.$queryRaw<{ id: string; invitedBy: string | null }[]>`
      SELECT id, invited_by AS "invitedBy" FROM players
      WHERE id::text LIKE ${code.toLowerCase() + "%"} LIMIT 2`;
    const host = hosts.length === 1 ? hosts[0]! : null;
    if (!host) throw new AppError(404, "INVITE_NOT_FOUND", "Código não encontrado");
    // Nem o próprio código, nem troca de convites entre os dois.
    if (host.id === me.id || host.invitedBy === me.id) {
      throw new AppError(409, "INVITE_SELF", "Use o código de outro jogador");
    }
    await tx.player.update({ where: { id: me.id }, data: { invitedBy: host.id } });
    await applyGems(tx, wallet, BigInt(INVITE_GUEST_GEMS), "invite_guest", idempotencyKey, now);
    await track(tx, me.id, "invite_redeemed");
    return {
      statusCode: 200,
      body: {
        gems: INVITE_GUEST_GEMS,
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}

/** Resgata os diamantes dos amigos que já chegaram às estrelas pedidas. */
export function claimInvites(now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const friends = await tx.player.findMany({
      where: { invitedBy: wallet.playerId },
      select: { id: true, evoStars: true, inviteRewardedAt: true },
      orderBy: { createdAt: "asc" },
    });
    const rewarded = friends.filter((f) => f.inviteRewardedAt !== null).length;
    const ready = friends
      .filter((f) => f.inviteRewardedAt === null && (f.evoStars ?? 0) >= INVITE_STARS)
      .slice(0, Math.max(0, INVITE_MAX_REWARDED - rewarded));
    if (ready.length === 0) {
      throw new AppError(409, "INVITE_NOTHING_TO_CLAIM", "Nenhum convite para resgatar ainda");
    }
    await tx.player.updateMany({
      where: { id: { in: ready.map((f) => f.id) } },
      data: { inviteRewardedAt: now },
    });
    const gems = ready.length * INVITE_HOST_GEMS;
    await applyGems(tx, wallet, BigInt(gems), "invite_host", idempotencyKey, now);
    await track(tx, wallet.playerId, "invite_rewarded", { friends: ready.length });
    return {
      statusCode: 200,
      body: {
        gems,
        friends: ready.length,
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}
