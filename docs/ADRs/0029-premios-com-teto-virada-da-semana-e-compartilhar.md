# ADR 0029 — Prêmios com teto no estágio do jogador, virada da semana limpa e compartilhar posição

- **Status:** aceita · 2026-10-24
- **Contexto:** o titular viu que, depois de vender o império, missões e eventos davam prêmios
  "como se não tivesse vendido" e o recomeço ficava rápido demais; que o ranking e os eventos
  pareciam começar com a pontuação antiga; e pediu compartilhar a posição no Facebook. A conta
  de testes "Magalhães" (277 estrelas) aparecia no ranking de Estrelas.

## Decisões

- **Teto dos prêmios em moedas** (missões e calendário de 7 dias): no máximo o preço do próximo
  negócio a construir (`rewardCap`). Com as estrelas, 15 min de renda no 1º mapa pagavam vários
  negócios. Império completo: sem teto. O piso fixo de cada dia do calendário continua.
- **Virada da semana:** a produção dos ajudantes liquidada na segunda, mas feita antes da
  meia-noite de domingo, é lançada na semana anterior (proporcional ao tempo). O ranking da
  semana nova começa do zero de fato. O jogo diz no ranking que a pontuação zera toda segunda.
- **Evento de fim de semana:** quem vende o império durante o evento recomeça do zero (contagem
  a partir da venda) e a meta é recalculada com a renda do império novo.
- **Compartilhar no Facebook:** `GET /api/v1/share/rank/:playerId?t=semana|liga|estrelas` (pública)
  devolve uma página com título "Fulano está em Nº lugar…" e a imagem `img/compartilhar.jpg` do
  site (Open Graph); quem clica vai para o site com os links das lojas. O jogo abre o
  `facebook.com/sharer` com esse link. Conta da equipe não mostra posição.
- Conta "Magalhães" (testes) marcada como equipe no admin.
