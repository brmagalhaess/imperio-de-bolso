# ADR 0031 — Compras de teste e contas da equipe fora das estatísticas do painel

- **Status:** aceita · 2026-10-24
- **Contexto:** o titular viu que o painel contava as compras de teste (Sandbox do iPhone de
  desenvolvimento) e as contas da equipe nas estatísticas, distorcendo os números. Pediu que
  fiquem só no registro e não apareçam em lugar nenhum do painel.

## Decisões

- `purchase_receipts.test` e `subscriptions.test`: compra sem cobrança — Sandbox da Apple
  (`environment != Production`), testador licenciado do Google (`purchaseType = 0` /
  `testPurchase`) ou loja "mock". A entrega no jogo é igual; só o painel separa. Migração marca
  como teste o que era "mock" ou de conta da equipe (o ambiente não era guardado antes).
- Painel: receita, tendências, assinantes e contagens usam só compras reais de quem não é da
  equipe. Compras de teste de jogadores comuns (ex.: revisão da Apple) aparecem na lista
  marcadas "Teste" e num contador à parte.
- Contas da equipe não aparecem em nenhuma tela nem número do painel (visão geral, economia,
  ranking, moderação, eventos, receita, lista de jogadores) — só no filtro "Equipe" da lista de
  jogadores, para poder gerenciá-las.
