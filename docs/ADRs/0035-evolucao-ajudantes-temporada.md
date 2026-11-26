# ADR 0035 — Evolução por mapa, ajudantes com nível, estrelas, temporada, desafios e mapa 2D

Data: 2026-11-25 · Status: aceita (pedido do titular)

## Contexto
O titular pediu o jogo "mais moderno" sem resetar quem já joga: mapa que se move em todas as
direções com as ilhas ligadas, próximo mapa só com o atual todo evoluído, ajudantes que evoluem,
ranking global por evolução, temporada de 20 dias com prêmios, mais missões e desafios, anúncios
limitados a 10 por 24 h com prêmio menor, e ideias para viralizar.

## Decisão

### Economia (servidor)
- **Evolução**: cada negócio tem 5 evoluções pelas faixas que já trocavam a arte (níveis 1, 10,
  25, 50 e 100). Cada evolução **triplica o lucro** (`economy/evolution.ts`) e vale 1 **estrela de
  evolução**. Sem o ×3, levar um mapa ao nível 100 levaria meses (custo ×1,15 por nível contra
  receita ×1,10); com ele a simulação (`scripts/simulate-maps.ts`) dá ~4 h na praia e ~1 dia por
  mapa para quem produz metade do tempo.
- **Mapa novo**: abre quando **todos os negócios do mapa mais avançado estão no nível máximo**.
  `players.unlocked_maps` guarda quantos estão abertos e nunca diminui — nem ao vender o
  império (quem vende atravessa rápido os mapas já conquistados). Jogador antigo (coluna NULL)
  é convertido na primeira abertura pela regra antiga: **o que estava aberto continua aberto**;
  ter negócio num mapa também o mantém aberto. Regra em `services/progress.ts`.
- **Vender o império**: além de negócios e ajudantes dos 8 primeiros mapas, todos no nível 100.
- **Ajudantes com nível** (1–10) e especialidade fixa por negócio (`economy/helpers.ts`):
  Vendedor (+20% de lucro por nível), Veloz (+30 pontos de velocidade por nível) e Noturno
  (+1 h de produção offline e +8% de lucro por nível). Preço do nível n = preço do ajudante ×
  4^(n−1). `POST /managers/upgrade`.
- **Estrelas de evolução**: `players.evo_stars` (acumuladas, nunca diminuem; jogador antigo
  recebe as evoluções que já tinha) e `player_seasons.stars` (ganhas na temporada).
- **Rankings**: `GET /leaderboard/evolution` (global, estrelas acumuladas) e
  `GET /leaderboard/season` (temporada de 20 dias a partir de 25/11/2026; ordena por estrelas
  ganhas, desempate pelo faturamento de produção). Prêmios em diamantes — 1º 1000, 2º 600,
  3º 400, 4º–10º 200, 11º–50º 80 e 20 de participação para quem ganhou 10+ estrelas — entram
  nos avisos de pódio (`kind: "temporada"`, `week: "T<n>"`). O ranking semanal por dinheiro e
  as ligas continuam iguais.
- **Missões e desafios**: 3 missões diárias novas (evoluir ajudante, subir níveis, maratona de
  coleta) e **desafios da semana** — 3 por semana, 8 diamantes cada, na mesma tabela das
  missões (`day = "S" + segunda-feira`), devolvidos em `GET /missions` → `challenges`.
- **Anúncios**: coleta antecipada com anúncio = **10 a cada 24 h corridas** (cada um libera de
  novo 24 h depois de assistido; o catálogo informa `nextAt`) e **5 min** de produção do mapa
  (era 15), proporcional ao ciclo.
- **Convide amigos**: o código do jogador é o convite. Quem usa ganha 20 diamantes; quem
  convidou ganha 40 quando o amigo chega a 20 estrelas de evolução (até 20 amigos).
  `GET /invites`, `POST /invites/redeem`, `POST /invites/claim`.

### Jogo
- **Mapa 2D**: as ilhas de expansão descem em escada para a esquerda, com a ponte de cada uma
  chegando na terra anterior; bordas se desfazem no mar (`edge_feather.gdshader`). A câmera anda
  em todas as direções com inércia e pinça (0,72× a 1,8×), dentro do corredor das ilhas.
- Estrelas nos lotes e no painel, botão de evoluir ajudante, abas Temporada/Evolução no ranking,
  desafios na tela de missões, contagem regressiva do anúncio, convite no Perfil.
- Sem o anel amarelo de seleção (ficava fora de posição).

## Compatibilidade
- Nada é zerado. Migração só acrescenta colunas/tabela.
- O jogo 1.1.0 continua funcionando com o servidor novo (campos a mais são ignorados); ele ainda
  prevê "mapa liberado" ao comprar o último negócio, mas o servidor corrige na resposta.
- O servidor sobe antes; a 1.2.0 traz as telas novas.

## Consequências
- Quem tinha mapas abertos com níveis baixos fica com eles, mas só abre o próximo ao evoluir o
  mais avançado ao máximo. O lucro de todos sobe com o ×3 das evoluções já feitas.
- Dois tipos de estrela: de **evolução** (⭐ nos negócios, ranking Evolução/Temporada) e de
  **investidor** (venda do império, aba Investidor).
