import type { Db } from "../db/prisma.js";
import { AppError } from "../errors.js";
import { track } from "./analytics.js";

// Nome do jogador (Perfil): pode ser trocado UMA vez (pedido do titular). O nome aparece no
// ranking, então é validado: tamanho, caracteres, palavras ofensivas e duplicidade.

export const NAME_MIN = 3;
export const NAME_MAX = 20;
const ALLOWED = /^[\p{L}\p{N} ._-]+$/u;

/** Lista básica de termos bloqueados (pt-BR). Moderação completa fica para o painel admin. */
const BLOCKED = [
  "porra",
  "caralho",
  "puta",
  "puto",
  "merda",
  "buceta",
  "cu",
  "fdp",
  "foda",
  "viado",
  "arrombado",
  "piroca",
  "pau",
  "bosta",
  "cacete",
  "corno",
  "vagabund",
  "otario",
  "nazi",
  "hitler",
  "admin",
  "moderador",
  "suporte",
  "imperio de bolso",
];

/** Normaliza para comparar: minúsculas, sem acento e com números trocados por letras. */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[0@4]/g, (c) => ({ "0": "o", "@": "a", "4": "a" })[c] ?? c)
    .replace(/[1!]/g, "i")
    .replace(/3/g, "e")
    .replace(/[5$]/g, "s");
}

export function validateName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new AppError(
      422,
      "NAME_INVALID",
      `O nome deve ter de ${NAME_MIN} a ${NAME_MAX} caracteres`,
    );
  }
  if (!ALLOWED.test(name)) {
    throw new AppError(422, "NAME_INVALID", "Use letras, números, espaço, ponto, hífen ou _");
  }
  const n = normalize(name);
  const words = n.split(/[\s._-]+/);
  if (BLOCKED.some((b) => (b.includes(" ") || b.length > 4 ? n.includes(b) : words.includes(b)))) {
    throw new AppError(422, "NAME_NOT_ALLOWED", "Esse nome não é permitido");
  }
  return name;
}

export async function changeName(db: Db, playerId: string, raw: string, now: Date) {
  const name = validateName(raw);
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
  if (player.nameChangedAt) {
    throw new AppError(409, "NAME_ALREADY_CHANGED", "Você já trocou de nome uma vez");
  }
  const taken = await db.player.findFirst({
    where: { id: { not: playerId }, displayName: { equals: name, mode: "insensitive" } },
  });
  if (taken) throw new AppError(409, "NAME_TAKEN", "Esse nome já está em uso");
  try {
    // A condição "nameChangedAt: null" garante uma única troca mesmo com pedidos simultâneos.
    const r = await db.player.updateMany({
      where: { id: playerId, nameChangedAt: null },
      data: { displayName: name, nameChangedAt: now },
    });
    if (r.count !== 1)
      throw new AppError(409, "NAME_ALREADY_CHANGED", "Você já trocou de nome uma vez");
  } catch (err) {
    // Índice único parcial (nomes escolhidos): outro jogador pegou o nome no mesmo instante.
    if ((err as { code?: string }).code === "P2002") {
      throw new AppError(409, "NAME_TAKEN", "Esse nome já está em uso");
    }
    throw err;
  }
  await track(db, playerId, "name_changed");
}
