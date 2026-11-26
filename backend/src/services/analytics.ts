import type { Db, Tx } from "../db/prisma.js";

// Eventos de analytics (docs/README.md §13). Sem dados pessoais nas propriedades.
// Eventos econômicos são registrados pelo servidor; o jogo só envia os de interface.

/** Eventos que o cliente pode enviar (os demais só o servidor registra). */
export const CLIENT_EVENTS = [
  "tutorial_started",
  "tutorial_step",
  "tutorial_skipped",
  "screen_view",
  "rank_shared",
  "crash",
] as const;

export async function track(
  db: Db | Tx,
  playerId: string | null,
  name: string,
  props: Record<string, unknown> = {},
): Promise<void> {
  await db.analyticsEvent.create({ data: { playerId, name, props: props as object } });
}
