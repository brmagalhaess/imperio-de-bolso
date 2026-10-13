import type { Db, Tx } from "../db/prisma.js";
import type { BusinessDefinition, PlayerBusiness } from "../generated/prisma/client.js";
import { Errors } from "../errors.js";
import { DISTRICTS, previousDistrict } from "../economy/districts.js";
import { nextUpgradeCost, profitPerCycle } from "../economy/formulas.js";
import { OFFLINE_CAP_MS, settle } from "../economy/offline.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { applyCoins, type LockedWallet } from "./wallet.js";

// Ciclo manual: ao terminar, o negócio fica parado com 1 ciclo pronto até o jogador
// coletar; a coleta credita e já inicia o próximo ciclo.
// Ajudante (gerente da doc) — ADR 0006: no mapa aberto o negócio continua manual; quando o
// jogador sai do mapa (ou fecha o jogo) ele passa a produzir AFK, até 4h (economy/offline.ts),
// e o servidor paga ao voltar ao mapa (POST /presence). Auto-coleta no mapa aberto é item da
// Loja (players.auto_collect).

/** Presença vale enquanto o jogo manda sinal (a cada ~15 s); depois disso conta como fora. */
export const PRESENCE_TIMEOUT_MS = 45_000;

type Reader = Db | Tx;

export interface BusinessView {
  slug: string;
  name: string;
  sortOrder: number;
  district: string;
  cost: string;
  cycleSeconds: number;
  owned: boolean;
  level: number;
  maxLevel: number;
  profitPerCycle: string;
  nextUpgradeCost: string | null;
  cycleStartedAt: string | null;
  cycleEndsAt: string | null;
  ready: boolean;
  secondsRemaining: number;
  /** Ajudante contratado. */
  managed: boolean;
  /** Produzindo sozinho agora (AFK fora do mapa, ou auto-coleta da Loja): sem bolha. */
  automatic: boolean;
  managerCost: string;
  /** Automático: lucro já produzido e ainda não liquidado (estimativa de leitura). */
  pendingAmount: string;
}

export interface DistrictView {
  id: string;
  unlocked: boolean;
  /** Distrito que precisa estar completo (todos os negócios comprados), ou null. */
  requires: string | null;
}

export interface PlayerStateView {
  player: {
    id: string;
    displayName: string;
    tutorialCompleted: boolean;
    currentDistrict: string | null;
    autoCollect: boolean;
  };
  wallet: { coins: string; gems: string };
  businesses: BusinessView[];
  districts: DistrictView[];
  serverTime: string;
}

/** Com ajudante e fora do ciclo manual: produção liquidada pelo servidor. */
export function isAutomatic(pb: PlayerBusiness | undefined): boolean {
  return Boolean(pb?.managerUnlocked && pb.cycleStartedAt === null);
}

function cycleStatus(pb: PlayerBusiness | undefined, cycleSeconds: number, now: Date) {
  if (pb && isAutomatic(pb)) {
    // Ciclo "virtual" do ajudante: posição atual dentro do ciclo, a partir da última liquidação.
    const s = settle({
      now,
      lastSettlementAt: pb.lastSettlementAt,
      carryMs: pb.carryMs,
      cycleSeconds,
    });
    const startedAt = new Date(now.getTime() - s.carryMs);
    const endsAt = new Date(startedAt.getTime() + cycleSeconds * 1000);
    return {
      startedAt,
      endsAt,
      ready: false,
      secondsRemaining: Math.max(1, Math.ceil((endsAt.getTime() - now.getTime()) / 1000)),
      pendingCycles: s.cycles,
    };
  }
  if (!pb?.cycleStartedAt) {
    return { startedAt: null, endsAt: null, ready: false, secondsRemaining: 0, pendingCycles: 0 };
  }
  const endsAt = new Date(pb.cycleStartedAt.getTime() + cycleSeconds * 1000);
  const remainingMs = endsAt.getTime() - now.getTime();
  return {
    startedAt: pb.cycleStartedAt,
    endsAt,
    ready: remainingMs <= 0,
    secondsRemaining: Math.max(0, Math.ceil(remainingMs / 1000)),
    pendingCycles: 0,
  };
}

function toBusinessView(
  def: BusinessDefinition,
  pb: PlayerBusiness | undefined,
  now: Date,
): BusinessView {
  const level = pb?.level ?? 1;
  const status = cycleStatus(pb, def.cycleSeconds, now);
  const upgrade = pb ? nextUpgradeCost(def, level) : null;
  return {
    slug: def.slug,
    name: def.name,
    sortOrder: def.sortOrder,
    district: def.district,
    cost: def.cost.toString(),
    cycleSeconds: def.cycleSeconds,
    owned: Boolean(pb),
    level: pb ? level : 0,
    maxLevel: def.maxLevel,
    profitPerCycle: profitPerCycle(def, level).toString(),
    nextUpgradeCost: upgrade === null ? null : upgrade.toString(),
    cycleStartedAt: status.startedAt?.toISOString() ?? null,
    cycleEndsAt: status.endsAt?.toISOString() ?? null,
    ready: status.ready,
    secondsRemaining: status.secondsRemaining,
    managed: pb?.managerUnlocked ?? false,
    automatic: isAutomatic(pb),
    managerCost: def.managerCost.toString(),
    pendingAmount: (profitPerCycle(def, level) * BigInt(status.pendingCycles)).toString(),
  };
}

export async function listBusinesses(
  db: Reader,
  playerId: string,
  now: Date,
): Promise<BusinessView[]> {
  const [defs, owned] = await Promise.all([
    db.businessDefinition.findMany({ orderBy: { sortOrder: "asc" } }),
    db.playerBusiness.findMany({ where: { playerId } }),
  ]);
  const byBusiness = new Map(owned.map((pb) => [pb.businessId, pb]));
  return defs.map((def) => toBusinessView(def, byBusiness.get(def.id), now));
}

/** Distrito liberado quando todos os negócios do distrito anterior foram comprados. */
export function districtViews(businesses: BusinessView[]): DistrictView[] {
  const complete = (d: string) => businesses.filter((b) => b.district === d).every((b) => b.owned);
  return DISTRICTS.map((id) => {
    const requires = previousDistrict(id);
    return { id, unlocked: requires === null || complete(requires), requires };
  });
}

export async function getPlayerState(
  db: Reader,
  playerId: string,
  now: Date,
): Promise<PlayerStateView> {
  const player = await db.player.findUnique({ where: { id: playerId }, include: { wallet: true } });
  if (!player?.wallet) throw Errors.unauthorized();
  const businesses = await listBusinesses(db, playerId, now);
  return {
    player: {
      id: player.id,
      displayName: player.displayName,
      tutorialCompleted: player.tutorialCompletedAt !== null,
      currentDistrict: player.currentDistrict,
      autoCollect: player.autoCollect,
    },
    wallet: { coins: player.wallet.coins.toString(), gems: player.wallet.gems.toString() },
    businesses,
    districts: districtViews(businesses),
    serverTime: now.toISOString(),
  };
}

async function findDefinition(tx: Tx, slug: string): Promise<BusinessDefinition> {
  const def = await tx.businessDefinition.findUnique({ where: { slug } });
  if (!def) throw Errors.businessNotFound(slug);
  return def;
}

export function purchaseBusiness(slug: string, now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const def = await findDefinition(tx, slug);
    const existing = await tx.playerBusiness.findUnique({
      where: { playerId_businessId: { playerId: wallet.playerId, businessId: def.id } },
    });
    if (existing) throw Errors.businessAlreadyOwned(slug);

    const requires = previousDistrict(def.district);
    if (requires) {
      const [total, owned] = await Promise.all([
        tx.businessDefinition.count({ where: { district: requires } }),
        tx.playerBusiness.count({
          where: { playerId: wallet.playerId, business: { district: requires } },
        }),
      ]);
      if (owned < total) throw Errors.districtLocked(def.district, requires);
    }

    await applyCoins(tx, wallet, -def.cost, `business_purchase:${slug}`, idempotencyKey);
    await tx.playerBusiness.create({
      data: {
        playerId: wallet.playerId,
        businessId: def.id,
        level: 1,
        cycleStartedAt: now,
        lastSettlementAt: now,
      },
    });

    return {
      statusCode: 201,
      body: { purchased: slug, state: await getPlayerState(tx, wallet.playerId, now) },
    };
  };
}

export function upgradeBusiness(slug: string, now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const def = await findDefinition(tx, slug);
    const pb = await tx.playerBusiness.findUnique({
      where: { playerId_businessId: { playerId: wallet.playerId, businessId: def.id } },
    });
    if (!pb) throw Errors.businessNotOwned(slug);

    const cost = nextUpgradeCost(def, pb.level);
    if (cost === null) throw Errors.maxLevel(slug);
    const newLevel = pb.level + 1;

    // Produzindo sozinho: o que já foi produzido é pago no nível antigo antes de subir.
    let current = wallet;
    if (isAutomatic(pb)) {
      current = (
        await settleAutomatic(tx, wallet, now, `${idempotencyKey}:settle`, { businessId: def.id })
      ).wallet;
    }
    await applyCoins(tx, current, -cost, `business_upgrade:${slug}:${newLevel}`, idempotencyKey);
    await tx.playerBusiness.update({
      where: { playerId_businessId: { playerId: wallet.playerId, businessId: def.id } },
      data: { level: newLevel },
    });

    return {
      statusCode: 200,
      body: {
        upgraded: slug,
        level: newLevel,
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}

/** Coleta um negócio (slug) ou todos os prontos (slug ausente). */
export function collectProduction(slug: string | undefined, now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const all = await tx.playerBusiness.findMany({
      where: { playerId: wallet.playerId, ...(slug ? { business: { slug } } : {}) },
      include: { business: true },
    });
    if (slug && all.length === 0) {
      await findDefinition(tx, slug); // 404 se o slug não existe
      throw Errors.businessNotOwned(slug);
    }
    if (slug && isAutomatic(all[0])) throw Errors.managerActive(slug);
    const owned = all.filter((pb) => !isAutomatic(pb));

    const ready = owned.filter((pb) => cycleStatus(pb, pb.business.cycleSeconds, now).ready);
    if (ready.length === 0) {
      const first = owned[0];
      if (slug && first) {
        const status = cycleStatus(first, first.business.cycleSeconds, now);
        throw Errors.notReady(slug, status.secondsRemaining);
      }
      throw Errors.nothingToCollect();
    }

    const collected = ready.map((pb) => ({
      slug: pb.business.slug,
      amount: profitPerCycle(pb.business, pb.level),
    }));
    const total = collected.reduce((sum, c) => sum + c.amount, 0n);

    if (total > 0n) {
      await applyCoins(tx, wallet, total, "production_collect", idempotencyKey);
    }
    await tx.playerBusiness.updateMany({
      where: {
        playerId: wallet.playerId,
        businessId: { in: ready.map((pb) => pb.businessId) },
      },
      data: { cycleStartedAt: now, lastSettlementAt: now },
    });

    return {
      statusCode: 200,
      body: {
        collected: collected.map((c) => ({ slug: c.slug, amount: c.amount.toString() })),
        total: total.toString(),
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}

export interface SettledItem {
  slug: string;
  cycles: number;
  amount: string;
}

/**
 * Liquida negócios em produção automática (filtrados por mapa e/ou negócio): credita os
 * ciclos completos (teto de 4h) e guarda a sobra. Usa a carteira já travada.
 */
async function settleAutomatic(
  tx: Tx,
  wallet: LockedWallet,
  now: Date,
  ledgerKey: string,
  filter: { district?: string; businessId?: number } = {},
): Promise<{
  wallet: LockedWallet;
  items: SettledItem[];
  total: bigint;
  elapsedMs: number;
  capped: boolean;
}> {
  const automatic = await tx.playerBusiness.findMany({
    where: {
      playerId: wallet.playerId,
      managerUnlocked: true,
      cycleStartedAt: null,
      ...(filter.businessId ? { businessId: filter.businessId } : {}),
      ...(filter.district ? { business: { district: filter.district } } : {}),
    },
    include: { business: true },
  });
  const items: SettledItem[] = [];
  let total = 0n;
  let elapsedMs = 0;
  let capped = false;
  for (const pb of automatic) {
    const s = settle({
      now,
      lastSettlementAt: pb.lastSettlementAt,
      carryMs: pb.carryMs,
      cycleSeconds: pb.business.cycleSeconds,
    });
    const amount = profitPerCycle(pb.business, pb.level) * BigInt(s.cycles);
    total += amount;
    elapsedMs = Math.max(elapsedMs, s.elapsedMs);
    capped ||= s.capped;
    if (s.cycles > 0) {
      items.push({ slug: pb.business.slug, cycles: s.cycles, amount: amount.toString() });
    }
    await tx.playerBusiness.update({
      where: { playerId_businessId: { playerId: pb.playerId, businessId: pb.businessId } },
      data: { lastSettlementAt: now, carryMs: s.carryMs },
    });
  }
  const updated =
    total > 0n ? await applyCoins(tx, wallet, total, "production_auto", ledgerKey) : wallet;
  return { wallet: updated, items, total, elapsedMs, capped };
}

/** Negócios com ajudante de um mapa saem do modo manual e passam a produzir AFK desde `at`. */
async function startAfk(tx: Tx, playerId: string, district: string, at: Date): Promise<void> {
  const manual = await tx.playerBusiness.findMany({
    where: {
      playerId,
      managerUnlocked: true,
      cycleStartedAt: { not: null },
      business: { district },
    },
    include: { business: true },
  });
  for (const pb of manual) {
    const cycleMs = pb.business.cycleSeconds * 1000;
    const progress = at.getTime() - (pb.cycleStartedAt as Date).getTime();
    await tx.playerBusiness.update({
      where: { playerId_businessId: { playerId, businessId: pb.businessId } },
      data: {
        cycleStartedAt: null,
        lastSettlementAt: at,
        carryMs: Math.min(Math.max(progress, 0), cycleMs),
      },
    });
  }
}

/** Ao voltar ao mapa (já liquidado), os negócios automáticos retomam o ciclo manual. */
async function resumeManual(tx: Tx, playerId: string, district: string, now: Date) {
  const automatic = await tx.playerBusiness.findMany({
    where: { playerId, managerUnlocked: true, cycleStartedAt: null, business: { district } },
  });
  for (const pb of automatic) {
    await tx.playerBusiness.update({
      where: { playerId_businessId: { playerId, businessId: pb.businessId } },
      // Continua de onde o ciclo AFK parou (a sobra vira andamento do ciclo manual).
      data: { cycleStartedAt: new Date(now.getTime() - pb.carryMs), carryMs: 0 },
    });
  }
}

function freshPresence(
  player: { currentDistrict: string | null; lastSeenAt: Date | null },
  now: Date,
) {
  return (
    player.currentDistrict !== null &&
    player.lastSeenAt !== null &&
    now.getTime() - player.lastSeenAt.getTime() <= PRESENCE_TIMEOUT_MS
  );
}

/**
 * Presença por mapa (ADR 0006). O jogo chama ao abrir, ao trocar de mapa e a cada ~15 s.
 * - Saindo de um mapa (ou sem sinal há mais de 45 s): os negócios com ajudante dele passam a
 *   produzir AFK desde o momento em que o jogador saiu (último sinal).
 * - Entrando num mapa: paga o AFK acumulado dele (teto 4h) e, sem auto-coleta, volta ao manual.
 * - Ficando no mesmo mapa com auto-coleta (Loja): liquida a produção desse mapa.
 */
export function enterDistrict(district: string, now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    if (!(DISTRICTS as readonly string[]).includes(district))
      throw Errors.districtNotFound(district);
    const player = await tx.player.findUniqueOrThrow({ where: { id: wallet.playerId } });
    const fresh = freshPresence(player, now);
    const stayed = fresh && player.currentDistrict === district;
    const leftAt = fresh ? now : (player.lastSeenAt ?? now);

    if (player.currentDistrict && !stayed) {
      await startAfk(tx, player.id, player.currentDistrict, leftAt);
    }
    let result = {
      wallet,
      items: [] as SettledItem[],
      total: 0n,
      elapsedMs: 0,
      capped: false,
    };
    if (!stayed || player.autoCollect) {
      if (player.autoCollect) await startAfk(tx, player.id, district, now);
      result = await settleAutomatic(tx, wallet, now, idempotencyKey, { district });
      if (!player.autoCollect) await resumeManual(tx, player.id, district, now);
    }
    await tx.player.update({
      where: { id: player.id },
      data: { currentDistrict: district, lastSeenAt: now },
    });

    return {
      statusCode: 200,
      body: {
        district,
        returned: !stayed,
        settled: result.items,
        total: result.total.toString(),
        elapsedSeconds: Math.floor(result.elapsedMs / 1000),
        capped: result.capped,
        capSeconds: OFFLINE_CAP_MS / 1000,
        state: await getPlayerState(tx, wallet.playerId, now),
      },
    };
  };
}

/**
 * Contrata o ajudante. No mapa aberto (sem auto-coleta) o negócio segue manual e o ajudante
 * passa a produzir quando o jogador sair; fora do mapa ele já começa a produzir AFK agora.
 */
export function hireManager(slug: string, now: Date) {
  return async ({ tx, wallet, idempotencyKey }: CommandContext): Promise<CommandResult> => {
    const def = await findDefinition(tx, slug);
    const where = { playerId_businessId: { playerId: wallet.playerId, businessId: def.id } };
    const pb = await tx.playerBusiness.findUnique({ where });
    if (!pb) throw Errors.businessNotOwned(slug);
    if (pb.managerUnlocked) throw Errors.managerAlreadyHired(slug);

    await applyCoins(tx, wallet, -def.managerCost, `manager_hire:${slug}`, idempotencyKey);
    await tx.playerBusiness.update({ where, data: { managerUnlocked: true } });

    const player = await tx.player.findUniqueOrThrow({ where: { id: wallet.playerId } });
    const present = freshPresence(player, now) && player.currentDistrict === def.district;
    if (!present || player.autoCollect) await startAfk(tx, player.id, def.district, now);

    return {
      statusCode: 200,
      body: { hired: slug, state: await getPlayerState(tx, wallet.playerId, now) },
    };
  };
}

/** Marca o tutorial como concluído (idempotente; não mexe em saldo). */
export async function completeTutorial(db: Db, playerId: string, now: Date): Promise<void> {
  await db.player.updateMany({
    where: { id: playerId, tutorialCompletedAt: null },
    data: { tutorialCompletedAt: now },
  });
}
