# ADR 0024 — Pacotes promocionais em dinheiro real (vitrine semanal e de feriados)

- **Status:** aceita · 2026-10-18
- **Contexto:** com a loja paga funcionando no iPhone (ADR 0022), o titular pediu combos
  comprados com dinheiro real numa coluna à direita (espelhando missões/ranking à esquerda),
  com ícones chamativos, até R$ 499,90, ~10 tipos com 3 por semana e pacotes temáticos na
  semana de cada feriado — no máximo 5 ícones na tela. Tabela e limite aprovados pelo titular.

## Decisões

- **Catálogo** em `backend/src/economy/bundles.ts` (fonte única; `tools/apple/bundles_setup.py`
  lê dele para criar os produtos na App Store Connect): 1 Kit Iniciante (R$ 9,90, 1x por conta),
  9 da rotação em 3 faixas (baixa R$ 14,90–24,90, média R$ 29,90–49,90, alta R$ 99,90–499,90) e
  10 de feriado (R$ 29,90–99,90). Conteúdo: diamantes + horas de auto-coleta + horas de turbo
  2× + horas de produção na hora (coleta antecipada, no mapa atual).
- **Vitrine:** feriado da semana (se houver) + 3 da semana (um de cada faixa, rodízio fixo pelo
  número da semana) + Kit Iniciante (se nunca comprou) — no máximo 5. Semana = segunda a
  segunda no horário de Brasília (a mesma do ranking). Feriados: Ano Novo, Carnaval e Páscoa
  (móveis, pelo cálculo da Páscoa), Dia das Mães/Pais (2º domingo de maio/agosto), Festa Junina
  (24/6), Independência, Dia das Crianças, Black Friday (sexta após a 4ª quinta de novembro) e
  Natal.
- **Limite:** 1 compra por pacote enquanto ele está na vitrine (o comprado some até a próxima);
  o Kit Iniciante, 1 por conta. **A entrega nunca é recusada**: se a vitrine virou entre ver e
  pagar, o servidor entrega mesmo assim (o recibo único impede repetir).
- **Recibo:** o mesmo `/purchases/verify` (agora com `district` opcional); o recibo grava a
  hora do servidor (`createdAt = now`) para a regra da semana.
- **Jogo:** coluna à direita (`hud._sync_offers`) com pulso suave e o tempo restante; tela do
  pacote com o conteúdo e o preço da App Store. Arte: 20 ícones gerados no Higgsfield
  (`tools/art/jobs/v7-ofertas.json`, US$ 0,54) → `game/assets/optimized/offer_*.png`.
- **Estorno:** retira os diamantes (como os pacotes de diamantes); tempo de auto-coleta/turbo já
  concedido não é retirado.

## Consequências

- Produtos novos precisam de versão nova do app para aparecer (o 1.0.1 ignora `offers`).
- Trocar conteúdo/preço: editar `bundles.ts` + preço na App Store Connect (o script só cria).
