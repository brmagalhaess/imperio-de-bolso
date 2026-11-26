import type { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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
  /** Endereço público da API (link do post), ex.: https://api-imperio…/api/v1. */
  apiUrl: string;
}

const CARD = fileURLToPath(new URL("../../assets/compartilhar.jpg", import.meta.url));

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
    // Conta da equipe também compartilha: a posição que teria (ela segue fora das listas).
    if (player) {
      let rank: number | null = null;
      let where = "no ranking da semana";
      if (t === "estrelas") {
        rank = (await getStarsRanking(deps.db, playerId, now, true)).me?.rank ?? null;
        where = "no ranking de estrelas";
      } else {
        const lb = await getLeaderboard(deps.db, playerId, now, true);
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
    const { s } = z.object({ s: z.string().optional() }).parse(request.query);
    // Link do post (o que o Facebook lê e quem clica abre): sem "s", leva ao site do jogo.
    const pageUrl = `${deps.apiUrl}/share/rank/${playerId}?t=${t}`;
    const og = `<meta property="og:type" content="website">
<meta property="og:site_name" content="Império de Bolso">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">`;
    reply.header("content-type", "text/html; charset=utf-8");
    reply.header("cache-control", "public, max-age=300");
    if (s !== "1") {
      // Quem clicou no post (ou o robô do Facebook): título/imagem e redirecionamento ao site.
      return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
${og}
</head><body><p><a href="${esc(site)}/">${esc(title)} — jogue grátis</a></p>
<script>location.replace(${JSON.stringify(`${site}/`)});</script></body></html>`;
    }
    // Aberta pelo jogo (s=1): monta a imagem com o nome e a posição e abre a folha de
    // compartilhar do celular (Facebook, WhatsApp, Instagram…) com a imagem e o link.
    const caption = `${title} Baixe grátis e venha disputar comigo: ${site}/`;
    return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Compartilhar — Império de Bolso</title>
${og}
<style>
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;font:16px/1.4 -apple-system,system-ui,"Segoe UI",sans-serif;background:#0b3f3d;color:#fff;
  min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:20px 16px 32px}
h1{font-size:20px;margin:6px 0 14px;text-align:center}
img#card{width:100%;max-width:560px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.35);background:#174d4a}
.btns{width:100%;max-width:560px;display:flex;flex-direction:column;gap:10px;margin-top:18px}
button,a.btn{display:block;width:100%;border:0;border-radius:14px;padding:15px;font:600 17px/1 inherit;
  text-align:center;text-decoration:none;cursor:pointer;color:#fff}
.main{background:#ff9f1c;color:#3a2a14;font-size:19px}
.fb{background:#1877f2}.wa{background:#25d366;color:#08331a}.save{background:#ffffff22}
.note{opacity:.75;font-size:13px;text-align:center;margin-top:14px;max-width:560px}
</style></head><body>
<h1>Compartilhe sua posição</h1>
<img id="card" alt="Imagem do post">
<div class="btns">
  <button class="main" id="share">Compartilhar</button>
  <a class="btn fb" id="fb" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}">Abrir no Facebook</a>
  <a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(caption)}">Enviar no WhatsApp</a>
  <a class="btn save" id="save" download="imperio-de-bolso.png">Salvar a imagem</a>
</div>
<p class="note">Toque em Compartilhar e escolha o Facebook (ou outro app). No Facebook, a imagem
entra no post; escreva o que quiser e publique.</p>
<script>
const TITLE=${JSON.stringify(title)}, CAPTION=${JSON.stringify(caption)}, PAGE=${JSON.stringify(pageUrl)};
const base=new Image(); let file=null;
base.onload=()=>{
  const W=1200,H=630,S=120,c=document.createElement("canvas"); c.width=W; c.height=H+S;
  const x=c.getContext("2d"); x.drawImage(base,0,0,W,H);
  x.fillStyle="#0b3f3d"; x.fillRect(0,H,W,S); x.fillStyle="#ffd65a"; x.fillRect(0,H,W,6);
  x.fillStyle="#fff"; x.font="bold 40px -apple-system,system-ui,sans-serif"; x.textBaseline="middle";
  let txt=TITLE; while(x.measureText(txt).width>W-80&&txt.length>10) txt=txt.slice(0,-2);
  if(txt!==TITLE) txt=txt.slice(0,-1)+"…";
  x.fillText(txt,40,H+S/2+3);
  c.toBlob(b=>{ file=new File([b],"imperio-de-bolso.png",{type:"image/png"});
    const u=URL.createObjectURL(b); document.getElementById("card").src=u; document.getElementById("save").href=u; },"image/png");
};
base.src="card.jpg";
document.getElementById("share").onclick=async()=>{
  try{
    if(file&&navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],text:CAPTION}); return; }
    if(navigator.share){ await navigator.share({title:TITLE,text:CAPTION,url:PAGE}); return; }
  }catch(e){ if(e&&e.name==="AbortError") return; }
  location.href=document.getElementById("fb").href;
};
</script></body></html>`;
  });

  // Imagem base do post, servida daqui para a página montar o card (mesma origem do canvas).
  app.get("/share/rank/card.jpg", async (_request, reply) => {
    reply.header("content-type", "image/jpeg");
    reply.header("cache-control", "public, max-age=86400");
    return reply.send(await readFile(CARD));
  });
}
