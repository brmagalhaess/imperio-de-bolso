# ADR 0025 — Dobro de moedas e auto-coleta em todas as cidades

- **Status:** aceita · 2026-10-18
- **Contexto:** o titular pediu (1) um item "dobro de moedas" que dobra a arrecadação por 1 hora,
  caro por mexer na economia, vendido na Loja, até 3 vezes por mês, a ~R$ 129,99; (2) a
  auto-coleta comprada deve valer em todas as cidades, e os ajudantes offline também.

## Decisões

- **Dobro de moedas** (`double_1h`, consumível R$ 129,90 — faixa da Apple; R$ 129,99 não existe
  em BRL): multiplica a velocidade **total** por 2 (`speedPercentAt`: soma dos bônus × 2) de
  `doubleFrom` até `doubleUntil` (colunas novas em `players`), em toda a produção (manual, AFK,
  auto-coleta) e em todos os mapas. Soma com Turbo e VIP. O Turbo continua +100 pontos (não é
  2× de verdade para negócios de nível alto — por isso o Dobro vale o preço). Compra repetida
  soma horas. Limite: 3 por mês civil de Brasília (`usedThisMonth` no catálogo; a entrega nunca
  é recusada porque o pagamento já aconteceu).
- **Auto-coleta em todas as cidades:** com auto-coleta (Loja ou VIP), a cada sinal de presença o
  servidor liquida os ajudantes de **todos** os mapas (antes: só o aberto, e as outras cidades
  paravam no teto de 4h). Sem auto-coleta, ao **abrir o jogo** (sessão nova) o resumo offline
  paga os ajudantes de todos os mapas (teto de 4h em cada) em vez de só o do mapa de entrada.
  Liquidação sem ciclo fechado não grava no banco (mesmo resultado, menos escrita).
- **Jogo:** Turbo e Dobro ativos viram ícones redondos no topo da coluna direita (com o tempo
  restante; toque abre a Loja), acima dos pacotes — sem os antigos selos de texto.

## Consequências

- Economia: o Dobro é o maior acelerador do jogo; preço alto e limite mensal seguram o impacto.
- Teste antigo "só o mapa visitado é pago" foi substituído pelo novo comportamento.
