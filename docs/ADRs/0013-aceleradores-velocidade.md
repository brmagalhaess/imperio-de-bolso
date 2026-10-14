# ADR 0013 — Aceleradores de produção (velocidade)

- **Status:** aceita · 2026-10-14
- **Fonte:** pedido do titular ("a produção está muito lenta… ajudante aumenta alguns %, comprar
  velocidade na Loja por período, evoluir a construção aumenta, VIP também; tudo soma").
  Valores escolhidos pelo titular entre 3 propostas ("Proposta").

## Decisões

- **Velocidade = 100% + bônus somados:** ajudante +25%; marcos de nível 10, 25, 50, 75 e 100
  +50% cada; Passe VIP +50%; Turbo da Loja +100% (2×). Máximo 525%.
- **Ciclo efetivo** = ciclo do catálogo ÷ velocidade (mínimo 1 s). O servidor manda `cycleSeconds`
  efetivo, `baseCycleSeconds` e `speedPercent`.
- **Produção como "trabalho":** o AFK conta ms de ciclo base; cada trecho entre mudanças de
  velocidade (fim do Turbo/VIP, início do Turbo) usa a velocidade que tinha — Turbo acabando no
  meio do tempo fora não paga demais. A sobra (`carry_ms`) passa a ser trabalho.
- **Turbo:** `turbo_1h` 10 💎, `turbo_4h` 30 💎, `turbo_24h` 120 💎; vale para todos os mapas;
  comprar de novo soma tempo (`players.turbo_from/turbo_until`). Também vem de prêmios (ADR 0014).
- Jogo prevê a nova velocidade no toque (melhoria que cruza marco, contratação, Turbo) e mostra
  "Velocidade +X%" no painel e "⚡ Turbo 2× · tempo" no topo.

## Consequências

- Testes de AFK passaram a considerar +25% do ajudante (ex.: 100 s fora = 12 ciclos de 10 s).
- Balanceamento: os marcos dão o "salto" típico do gênero; ajustar só em `economy/speed.ts`.
