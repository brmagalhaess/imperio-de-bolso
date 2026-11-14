# ADR 0034 — 20 mapas e 12 negócios por mapa

Data: 2026-10-25 · Status: aceita (pedido do titular)

## Decisão
- 12 mapas novos depois do Centro Espacial: Ilha dos Piratas, Atlântida, Vale dos Dinossauros,
  Reino dos Pinguins, Cidade dos Doces, Cidade dos Brinquedos, Base Lunar, Colônia em Marte,
  Planeta dos Gatos, Anéis de Saturno, Planeta Gelatina e Império Galáctico.
- Mapas maiores: a praia passa de 4 para 6 negócios e os demais de 9 para 12 (segunda ilha de
  expansão). Total: 234 negócios.
- Preços: os negócios novos dos mapas antigos ficam entre o último do mapa e o primeiro do
  seguinte (mesma receita/custo do mapa); os mapas novos começam em ×1,35 do anterior e sobem
  ×1,15 por negócio (receita 4% do custo, ciclo 12 min, ajudante 4× o custo). Último: 5,6×10^22.
- Desbloqueio: o mapa anterior completo — e quem já tem negócio num mapa continua com ele aberto
  (os mapas antigos ganharam negócios; ninguém perde acesso). Regra única em
  `unlockedDistricts` (`economy/districts.ts`), usada no estado, na compra, nas missões e no evento.
- Vender o império: negócios e ajudantes dos 8 primeiros mapas (até o Centro Espacial). Exigir
  os 20 deixaria a venda a meses; ir além rende mais estrelas, porque elas vêm do faturamento.
- Conquistas para os 12 mapas novos e faturamento de 10^15 a 10^24; fases das missões
  recalibradas (6/18/30 negócios).
- Jogo: só o mapa aberto fica montado (memória do celular); a trilha usa miniaturas; lotes,
  ilhas e mapas que o servidor não envia ficam escondidos (o jogo novo pode chegar à loja antes
  do servidor).
- Arte: cenários dos mapas novos são edições do Centro Espacial (mesmos lotes); as 5 evoluções
  de cada negócio novo saem numa folha só (`tools/art/v8/`), recortadas pelo `processar.py`.

## Publicação
O servidor com os 20 mapas só vai ao ar depois que o jogo 1.1.0 estiver nas duas lojas, junto
com `MIN_APP_VERSION_IOS/ANDROID=1.1.0`: as versões antigas só mostram os negócios que conhecem
e travariam no fim de cada mapa.
