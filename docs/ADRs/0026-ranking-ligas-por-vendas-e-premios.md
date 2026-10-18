# ADR 0026 — Ranking: ligas por vendas do império, prêmios maiores e bônus que gira

- **Status:** aceita · 2026-10-18
- **Contexto:** o titular testou o ranking: prêmios só em texto (e pequenos), sem coroa/medalhas
  no pódio, "Sobem de liga: 1" lido como "Liga 1", promessa de "Selo VIP no perfil" sem selo, e
  pediu ligas separadas para quem vendeu o império (bônus de lucro permanente = disputa injusta).

## Decisões

- **Ligas por grupo de vendas** (`player_league_weeks.bracket`): 0 = nunca vendeu, 1…4 = vendeu
  N vezes, 5 = 5 ou mais. O grupo é fixado na 1ª visita da semana; vender no meio da semana só
  muda de grupo na semana seguinte, recomeçando no Bronze do grupo novo. Dentro do grupo seguem
  Bronze → Diamante (20% sobem/descem). O ranking geral da semana continua único.
- **Prêmios** (aprovados): semana 300/180/100 💎; liga 100/60/30 × multiplicador da liga
  (Bronze 1× … Diamante 3×). **Bônus que gira por semana** (índice da semana, mod 4): Turbo
  (6/4/2 h) → auto-coleta (3/2/1 dias) → coleta antecipada (12/8/4 h) → diamantes em dobro.
  Gravado no prêmio (`bonus_kind`/`bonus_hours`) e entregue no resgate (`grantBundle`).
- **Jogo:** faixa de prêmios com coroa/prata/bronze (arte nova, US$ 0,18), ícones no 1º–3º
  lugar, selo VIP no ranking (`vip` na resposta) e no Perfil; textos da liga reescritos.
- **VIP no aparelho de desenvolvimento:** compras no Sandbox da Apple têm "mês" de 5 min; a Loja
  avisa isso só no build de desenvolvimento.
