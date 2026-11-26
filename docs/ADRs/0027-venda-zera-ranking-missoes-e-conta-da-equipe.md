# ADR 0027 — Vender o império zera o ranking da semana, renova as missões; conta da equipe fora do ranking

- **Status:** aceita · 2026-10-19
- **Contexto:** o titular viu que, depois de vender o império, o jogador continuava em 1º no
  ranking com o faturamento antigo, e as missões do dia seguiam com prêmios do império grande
  (ex.: 2 tri para quem recomeça com 100 moedas), desequilibrando a economia. Também pediu que a
  conta do aparelho de desenvolvimento (equipe) não dispute o ranking com os jogadores.

## Decisões

- **Ranking da semana e liga contam só o faturamento depois da última venda dentro da semana.**
  O marco é o lançamento `prestige_reset` do ledger (exato e histórico: a venda numa semana não
  apaga o pódio da semana anterior). Substitui a regra da ADR 0011/0017 "vender não tira do
  ranking". O grupo de liga continua fixo na semana (ADR 0026).
- **Missões:** ao vender, as missões de hoje **ainda não resgatadas** saem e entram outras,
  sorteadas com a renda do império novo (alvo e prêmio). As já resgatadas ficam (o baú segue
  contando 3); nenhum modelo/grupo se repete no dia.
- **Conta da equipe** (`players.is_staff`, ligada pelo painel admin no detalhe do jogador): fora
  do ranking da semana, das ligas, das estrelas e do pódio. Ela vê o aviso "Conta da equipe" no
  ranking. `GET /leaderboard` traz `staff`.

## Consequências

- Vender o império tem um custo no ranking da semana — coerente com o recomeço no jogo.
- Prêmio diário e evento já usavam a renda do momento / meta fixa; não mudam.
