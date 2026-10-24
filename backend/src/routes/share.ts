import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/prisma.js";
import { getLeaderboard, getStarsRanking } from "../services/leaderboard.js";

// Compartilhar a posição no ranking (Facebook e outros): página pública com título, descrição e
// imagem (Open Graph) que o Facebook lê ao montar o post (o robô dele não roda JavaScript), e que
// leva quem clicar para o site do jogo. A posição é calculada aqui, na hora — o jogo só manda o id do jogador e a aba.

export interface ShareDeps {
  db: Db;
  now: () => Date;
  /** Site do jogo (links das lojas) e imagem do post. */
  siteUrl: string;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export async function shareRoutes(app: FastifyInstance, deps: ShareDeps): Promise<void> {
  app.get("/share/rank/:playerId", async (request, reply) => {
    const { playerId } = z.object({ playerId: z.uuid() }).parse(request.params);
    const { t } = z
      .object({ t: z.enum(["semana", "liga", "estrelas"]).default("semana") })
      .parse(request.query);
    const now = deps.now();
    const player = await deps.db.player.findUnique({
      where: { id: playerId },
      select: { displayName: true, staff: true },
    });
    let title = "Império de Bolso — monte seu império";
    if (player && !player.staff) {
      let rank: number | null = null;
      let where = "no ranking da semana";
      if (t === "estrelas") {
        rank = (await getStarsRanking(deps.db, playerId, now)).me?.rank ?? null;
        where = "no ranking de estrelas";
      } else {
        const lb = await getLeaderboard(deps.db, playerId, now);
        if (t === "liga") {
          rank = lb.league.me?.rank ?? null;
          where = `na Liga ${lb.league.name}`;
        } else rank = lb.me?.rank ?? null;
      }
      title = rank
        ? `${player.displayName} está em ${rank}º lugar ${where} do Império de Bolso!`
        : `${player.displayName} está construindo um império no Império de Bolso!`;
    }
    const site = deps.siteUrl.replace(/\/$/, "");
    const desc =
      "Do carrinho de água ao império: jogue grátis no iPhone e no Android e venha disputar o ranking.";
    const image = `${site}/img/compartilhar.jpg`;
    reply.header("content-type", "text/html; charset=utf-8");
    reply.header("cache-control", "public, max-age=300");
    return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Império de Bolso">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
</head><body><p><a href="${esc(site)}/">${esc(title)} — jogue grátis</a></p>
<script>location.replace(${JSON.stringify(`${site}/`)});</script></body></html>`;
  });
}
