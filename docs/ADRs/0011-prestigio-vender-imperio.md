# ADR 0011 — Prestígio: "Vender o império" (Etapa 6 · V1.1)

- **Status:** aceita · 2026-10-14
- **Fontes:** docs/README.md §4 (prestígio na versão completa) e §69 (V1.1 = prestígio e
  segundo bairro); escolha do titular entre 3 modelos ("Vender o império", recomendado).
- **Desvio registrado:** a Etapa 6 começa antes do teste fechado (aguardando as contas Google
  Play e Apple), a pedido do titular.

## Decisões

- **Estrelas de investidor** = ⌊√(faturamento de produção desde o último prestígio ÷ 1.000.000)⌋
  (ex.: 50 mi → 7; 2 bi → 44). Cada estrela = **+2% de lucro** em todos os negócios, para sempre.
- **Liberação:** cidade completa e ao menos 1 estrela a ganhar (`GET /prestige`).
- **Ao vender** (`POST /prestige`, comando idempotente): apaga negócios/níveis/ajudantes, saldo
  volta a 100 moedas (ledger `prestige_reset`), mapas voltam a bloquear, jogador volta à praia.
  **Mantém** diamantes, conquistas, Passe VIP, auto-coleta comprada, missões e ranking semanal.
- O bônus entra em toda produção no servidor: coleta manual, AFK dos ajudantes, auto-coleta,
  estimativas da Loja e contexto das missões (`profitPerCycle(def, nível, estrelas)`).
- Conquista nova "Investidor" (primeiro prestígio, 10 diamantes). Evento analítico `prestige`.
- Jogo: seção Prestígio no Perfil (estrelas, bônus, quanto rende vender) e confirmação que lista
  o que zera e o que fica; depois de vender o jogo volta à praia.
