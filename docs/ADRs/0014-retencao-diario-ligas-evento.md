# ADR 0014 — Retenção: prêmio diário, baú das missões, ligas e evento de fim de semana

- **Status:** aceita · 2026-10-14
- **Fonte:** pedido do titular ("mais missões, rank e estratégias para manter os jogadores
  voltando"); o titular escolheu os quatro itens propostos. docs/README.md §3/§8 (retenção).

## Decisões

- **Missões por fase** (ver contrato): alvos crescem com o número de negócios; sem missão de
  iniciante para quem evoluiu, nem missão impossível (construir/contratar só se der para pagar
  em até 30 min de renda); no máximo uma de faturar por dia; novas "Fature (1 h)" e "Assista 2
  anúncios".
- **Calendário de 7 dias:** 10 min de renda · 5 💎 · 30 min · Turbo 1 h · 10 💎 · 1 h de renda ·
  25 💎 + Turbo 2 h. Faltou um dia (Brasília), volta ao dia 1. Abre sozinho ao entrar.
- **Baú das missões:** resgatou as 3 do dia → +5 💎 e Turbo 30 min, uma vez por dia.
- **Ligas semanais:** Bronze → Prata → Ouro → Platina → Diamante. A liga da semana é definida na
  primeira visita (tabela `player_league_weeks`) pela posição na anterior: 20% do topo (que
  faturaram) sobem; 20% de baixo descem (ligas com 5+). Ranking geral da semana continua.
- **Ranking de estrelas** (prestígio, de todos os tempos).
- **Evento de fim de semana:** sexta 00:00 → segunda 00:00; o mapa mais avançado do jogador rende
  lucro 2× e há meta (≈2 h de renda) com 20 💎. Inscrição na primeira consulta (`player_events`);
  só quem entrou no evento recebe o 2×.

## Consequências

- Jogo: botões laterais "Diário" (selo quando há prêmio) e "Evento" (só no fim de semana); abas
  Liga · Semana · Estrelas no Ranking; baú no fim das Missões.
- Simplificação aceita: o 2× do evento vale para os ciclos liquidados durante o evento (AFK que
  atravessa a sexta 00:00 é pago em dobro).
