# ADR 0011 — Prestígio: "Vender o império" (Etapa 6 · V1.1)

- **Status:** aceita · 2026-10-14
- **Fontes:** docs/README.md §4 (prestígio na versão completa) e §69 (V1.1 = prestígio e
  segundo bairro); escolha do titular entre 3 modelos ("Vender o império", recomendado).
- **Desvio registrado:** a Etapa 6 começa antes do teste fechado (aguardando as contas Google
  Play e Apple), a pedido do titular.

## Decisões

- **Estrelas de investidor** = ⌊20 × log10(faturamento de produção desde o último prestígio ÷
  1.000.000)⌋ (ex.: 1 bi → 60; 1 tri → 120). Cada estrela = **+2% de lucro** em todos os
  negócios, para sempre. *Revisão 2026-10-15:* a fórmula original (raiz quadrada) dava +15.000%
  no 14º dia na simulação (`backend/scripts/simulate-player.ts`); a logarítmica fica entre +80% e
  +490% por venda e as vendas seguidas somam.
- **Liberação:** cidade completa e ao menos 1 estrela a ganhar (`GET /prestige`).
- **Ao vender** (`POST /prestige`, comando idempotente): apaga negócios/níveis/ajudantes, saldo
  volta a 100 moedas (ledger `prestige_reset`), mapas voltam a bloquear, jogador volta à praia.
  **Mantém** diamantes, conquistas, Passe VIP, auto-coleta comprada, missões e ranking semanal.
- O bônus entra em toda produção no servidor: coleta manual, AFK dos ajudantes, auto-coleta,
  estimativas da Loja e contexto das missões (`profitPerCycle(def, nível, estrelas)`).
- Conquista nova "Investidor" (primeiro prestígio, 10 diamantes). Evento analítico `prestige`.
- Jogo: seção Prestígio no Perfil (estrelas, bônus, quanto rende vender) e confirmação que lista
  o que zera e o que fica; depois de vender o jogo volta à praia.
