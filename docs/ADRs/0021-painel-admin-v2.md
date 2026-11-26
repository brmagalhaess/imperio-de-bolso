# ADR 0021 — Painel admin v2 (jogo atual + moderação de nomes)

- **Status:** aceita · 2026-10-15
- **Contexto:** o painel (`admin/`, Etapa 3) só mostrava visão geral, jogadores e eventos; o jogo
  ganhou 8 mapas/67 negócios, ajudantes, Turbo/VIP, prêmio diário, baú, ligas, pódio, venda do
  império, evento de fim de semana, contas vinculadas e denúncia de nomes (ADR 0020).

## Decisões

- Abas: **Visão geral** (jogadores, D1/D7, hoje no jogo, reforços ativos, evento, funil por mapa,
  denúncias abertas, compras/anúncios ligados), **Economia** (67 negócios: donos, ajudantes, nível
  médio/máximo e as 5 faixas visuais; entradas e saídas de 7 dias por tipo), **Ranking** (top 20 da
  semana, jogadores por liga, pódio da semana passada), **Moderação**, **Jogadores** (busca por nome
  ou código, ordenação, detalhe com estrelas, liga, reforços, missões de hoje, negócios por mapa e
  ledger traduzido) e **Eventos**.
- O painel deixa de ser 100% somente leitura: **as únicas escritas** são de moderação —
  `POST /api/admin/reports/:id/reset-name` (nome volta a "Empreendedor NNNN") e
  `POST /api/admin/reports/:id/dismiss` (arquiva sem trocar). Ambas pedem confirmação na tela e
  ficam registradas em analytics (`admin_name_reset`, `admin_report_dismissed`). Saldo, negócios
  e progresso continuam intocáveis pelo painel.
