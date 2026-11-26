# ADR 0030 — Painel admin v3: tendências, receita e ações de suporte

- **Status:** aceita · 2026-10-24
- **Contexto:** o titular pediu um painel mais bonito, com mais estatísticas e mais funções.

## Decisões

- **Visual:** menu lateral fixo (ícones), indicadores com destaque de cor, gráficos de barras em
  SVG (sem biblioteca), layout que vira coluna única no celular.
- **Tendências** (`GET /api/admin/trends?days=7|30|90`): por dia (Brasília) — novos jogadores,
  ativos (qualquer lançamento no ledger), compras e receita bruta estimada, anúncios assistidos,
  vendas do império. Na visão geral, com atualização automática opcional (1 min).
- **Receita** (`GET /api/admin/revenue`): totais (30 dias e geral), compradores, ticket médio,
  assinantes ativos por loja, por loja, por produto e compras recentes. Valor bruto pelo preço de
  tabela (a loja desconta a comissão). Compras "mock" ficam de fora.
- **Suporte:** `POST /players/:id/gems` (1–10.000 diamantes, motivo obrigatório, Idempotency-Key;
  ledger `admin_grant`) e `POST /purchases/revoke` (reembolso manual — o Google ainda não avisa
  sozinho). Ficha do jogador com compras, troca de nome e conta da equipe.
- **Jogadores:** filtros (ativos 24 h, novos, vinculados, venderam o império, equipe) e exportação
  CSV (Excel, separador ";").
