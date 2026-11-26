import type { Db, Tx } from "../db/prisma.js";
import { DISTRICTS, unlockedDistricts, type District } from "../economy/districts.js";
import { evolutionOf } from "../economy/evolution.js";
import { seasonAt } from "../economy/seasons.js";

// Progresso do jogador (ADR 0035):
// - Mapas: o próximo abre quando TODOS os negócios do mapa mais avançado estão no nível máximo.
//   `players.unlocked_maps` guarda quantos estão abertos e nunca diminui (nem ao vender o
//   império). Jogador antigo (NULL) é convertido uma vez pela regra antiga — o que estava aberto
//   continua aberto.
// - Estrelas de evolução: 1 por evolução de cada negócio, acumuladas para sempre
//   (`players.evo_stars`) e por temporada (`player_seasons`).

type Reader = Db | Tx;

interface OwnedRow {
  businessId: number;
  level: number;
}
interface DefRow {
  id: number;
  district: string;
  maxLevel: number;
}

export interface MapProgress {
  id: District;
  unlocked: boolean;
  total: number;
  owned: number;
  /** Negócios no nível máximo. */
  maxed: number;
  /** Estrelas de evolução do mapa agora e o máximo possível. */
  stars: number;
  maxStars: number;
}

export interface Progress {
  maps: MapProgress[];
  open: Set<District>;
  /** Estrelas de evolução acumuladas (ranking global). */
  evoStars: number;
}

function mastered(defs: DefRow[], byId: Map<number, OwnedRow>): boolean {
  return defs.length > 0 && defs.every((d) => (byId.get(d.id)?.level ?? 0) >= d.maxLevel);
}

/** Calcula (e grava, se mudou) mapas abertos e estrelas do jogador. */
export async function ensureProgress(db: Reader, playerId: string): Promise<Progress> {
  const [player, defs, owned] = await Promise.all([
    db.player.findUniqueOrThrow({
      where: { id: playerId },
      select: { unlockedMaps: true, evoStars: true },
    }),
    db.businessDefinition.findMany({ select: { id: true, district: true, maxLevel: true } }),
    db.playerBusiness.findMany({
      where: { playerId },
      select: { businessId: true, level: true },
    }),
  ]);
  const byId = new Map(owned.map((o) => [o.businessId, o]));
  const defsOf = (d: string) => defs.filter((x) => x.district === d);

  let count = player.unlockedMaps;
  if (count === null) {
    // Conversão única: o mapa mais avançado que a regra antiga dava como aberto.
    const legacy = unlockedDistricts(defs, new Set(owned.map((o) => o.businessId)));
    count = Math.max(1, ...DISTRICTS.map((d, i) => (legacy.has(d) ? i + 1 : 0)));
  }
  while (count < DISTRICTS.length && mastered(defsOf(DISTRICTS[count - 1]!), byId)) count += 1;

  const currentStars = owned.reduce((sum, o) => sum + evolutionOf(o.level), 0);
  const evoStars = player.evoStars ?? currentStars;
  if (count !== player.unlockedMaps || player.evoStars === null) {
    await db.player.update({
      where: { id: playerId },
      data: { unlockedMaps: count, evoStars },
    });
  }

  const open = new Set<District>(DISTRICTS.slice(0, count));
  const maps = DISTRICTS.map((id, i): MapProgress => {
    const mine = defsOf(id);
    const mineOwned = mine.flatMap((d) => byId.get(d.id) ?? []);
    // Negócio comprado num mapa mantém o mapa aberto (nunca tranca o que o jogador já usa).
    if (mineOwned.length > 0) open.add(id);
    return {
      id,
      unlocked: i < count || mineOwned.length > 0,
      total: mine.length,
      owned: mineOwned.length,
      maxed: mine.filter((d) => (byId.get(d.id)?.level ?? 0) >= d.maxLevel).length,
      stars: mineOwned.reduce((sum, o) => sum + evolutionOf(o.level), 0),
      maxStars: mine.length * 5,
    };
  });
  return { maps, open, evoStars };
}

/** Mapas abertos do jogador (regra nova, já convertendo o jogador antigo). */
export async function openDistricts(db: Reader, playerId: string): Promise<Set<District>> {
  return (await ensureProgress(db, playerId)).open;
}

/** Soma estrelas de evolução ganhas agora (compra = 1; cada evolução = 1) no total e na temporada. */
export async function addEvoStars(
  tx: Tx,
  playerId: string,
  gained: number,
  now: Date,
): Promise<void> {
  if (gained <= 0) return;
  // Jogador ainda não convertido (NULL): ensureProgress conta tudo, já com este ganho.
  await tx.player.updateMany({
    where: { id: playerId, evoStars: { not: null } },
    data: { evoStars: { increment: gained } },
  });
  const season = seasonAt(now).number;
  await tx.playerSeason.upsert({
    where: { playerId_season: { playerId, season } },
    create: { playerId, season, stars: gained },
    update: { stars: { increment: gained } },
  });
}
