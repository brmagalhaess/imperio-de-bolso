import type { Db, Tx } from "../db/prisma.js";
import type { BusinessDefinition, PlayerBusiness } from "../generated/prisma/client.js";
import { Errors } from "../errors.js";
import { DISTRICTS, previousDistrict } from "../economy/districts.js";
import { nextUpgradeCost, profitPerCycle } from "../economy/formulas.js";
import type { CommandContext, CommandResult } from "../lib/idempotency.js";
import { applyCoins } from "./wallet.js";

// Ciclo manual (sem gerente): ao terminar, o negócio fica parado com 1 ciclo
// pronto até o jogador coletar; a coleta credita e já inicia o próximo ciclo.
// Gerentes (Etapa 2) vão liquidar ciclos automaticamente com teto offline de 4h.

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
}

export interface DistrictView {
  id: string;
  unlocked: boolean;
  /** Distrito que precisa estar completo (todos os negócios comprados), ou null. */
  requires: string | null;
}

export interface PlayerStateView {
  player: { id: string; displayName: string };
  wallet: { coins: string; gems: string };
  businesses: BusinessView[];
  districts: DistrictView[];
  serverTime: string;
}

function cycleStatus(pb: PlayerBusiness | undefined, cycleSeconds: number, now: Date) {
  if (!pb?.cycleStartedAt) return { endsAt: null, ready: false, secondsRemaining: 0 };
  const endsAt = new Date(pb.cycleStartedAt.getTime() + cycleSeconds * 1000);
  const remainingMs = endsAt.getTime() - now.getTime();
  return {
    endsAt,
    ready: remainingMs <= 0,
    secondsRemaining: Math.max(0, Math.ceil(remainingMs / 1000)),
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
    cycleStartedAt: pb?.cycleStartedAt?.toISOString() ?? null,
    cycleEndsAt: status.endsAt?.toISOString() ?? null,
    ready: status.ready,
    secondsRemaining: status.secondsRemaining,
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
    player: { id: player.id, displayName: player.displayName },
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

    await applyCoins(tx, wallet, -cost, `business_upgrade:${slug}:${newLevel}`, idempotencyKey);
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
    const owned = await tx.playerBusiness.findMany({
      where: { playerId: wallet.playerId, ...(slug ? { business: { slug } } : {}) },
      include: { business: true },
    });
    if (slug && owned.length === 0) {
      await findDefinition(tx, slug); // 404 se o slug não existe
      throw Errors.businessNotOwned(slug);
    }

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
