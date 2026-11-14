# ADR 0003 — Ciclo de produção manual e gerentes

- **Status:** aceita · 2026-10-12

## Contexto

A documentação diz que gerentes "automatizam produção e habilitam ganhos offline limitados a
quatro horas". Logo, sem gerente a produção precisa depender do jogador.

## Decisão

- **Sem gerente:** ao comprar, o primeiro ciclo começa. Ao terminar, o negócio fica parado com
  **1 ciclo pronto** até a coleta. Coletar credita o lucro e já inicia o próximo ciclo
  (`player_businesses.cycle_started_at`). Tempo extra não acumula ciclos.
- **Com gerente (Etapa 2):** ciclos liquidados automaticamente na leitura/coleta:
  `tempo = clamp(agora − last_settlement_at, 0, 4h)`,
  `ciclos = floor((tempo + carry_seconds) / ciclo)`, sobra volta para `carry_seconds`.
  As colunas `manager_unlocked`, `carry_seconds` e `last_settlement_at` já existem.

## Consequências

- O valor do gerente fica claro para o jogador (motivação de progresso).
- A liquidação offline será uma função pura testável com relógio adulterado.
