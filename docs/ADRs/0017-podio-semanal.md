# ADR 0017 — Pódio semanal (1º, 2º e 3º lugar)

- **Status:** aceita · 2026-10-14
- **Fonte:** pedido do titular ("faltou as premiações do primeiro, segundo e terceiro lugar do
  rank, mostrar os prêmios e entregar depois que ganha"; "quem vende o império continua no rank").

## Decisões

- **Prêmios em diamantes:** ranking geral da semana 100 / 60 / 30; liga 30 / 20 / 10 × nível da
  liga (Bronze 1 … Diamante 5). Mostrados na tela do Ranking (abas Liga e Semana).
- **Entrega:** na primeira visita da semana seguinte o servidor confere a semana anterior uma vez
  (`players.rewards_checked_week`) e grava o prêmio (`player_weekly_rewards`); o jogo mostra
  "Parabéns! Você ficou em Nº lugar…" com o botão de resgatar (`POST /rewards/weekly/claim`,
  idempotente). Empate divide a posição (RANK). Só quem faturou na semana é premiado.
- **Prestígio não tira do ranking:** a pontuação é o faturamento de produção registrado no ledger;
  vender o império não apaga nada disso (teste automatizado).
