import { randomInt } from "node:crypto";
import type { Db } from "../db/prisma.js";
import { AppError } from "../errors.js";
import { track } from "./analytics.js";

// Denúncia de nome impróprio no ranking (diretriz 1.2 da App Store: conteúdo gerado pelo
// usuário precisa de denúncia e bloqueio). O bloqueio ("ocultar jogador") fica no aparelho.

/** Denunciantes diferentes para o nome escolhido voltar ao padrão automaticamente. */
export const REPORTS_TO_RESET = 3;

export async function reportPlayer(db: Db, reporterId: string, reportedId: string, now: Date) {
  if (reporterId === reportedId) {
    throw new AppError(422, "REPORT_SELF", "Não dá para denunciar a si mesmo");
  }
  const target = await db.player.findUnique({ where: { id: reportedId } });
  if (!target) throw new AppError(404, "PLAYER_NOT_FOUND", "Jogador não encontrado");
  await db.playerReport.upsert({
    where: { reporterId_reportedId: { reporterId, reportedId } },
    create: { reporterId, reportedId, createdAt: now },
    update: {},
  });
  const open = await db.playerReport.count({ where: { reportedId, resolvedAt: null } });
  let nameReset = false;
  // Só nomes escolhidos pelo jogador; o padrão "Empreendedor 1234" não tem o que moderar.
  if (open >= REPORTS_TO_RESET && target.nameChangedAt) {
    await db.player.update({
      where: { id: reportedId },
      data: { displayName: `Empreendedor ${randomInt(1000, 10000)}` },
    });
    await db.playerReport.updateMany({
      where: { reportedId, resolvedAt: null },
      data: { resolvedAt: now },
    });
    nameReset = true;
  }
  await track(db, reporterId, "player_reported", { reported: reportedId, nameReset });
  return { reported: true };
}
