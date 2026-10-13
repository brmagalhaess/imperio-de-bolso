# ADR 0007 — Retenção: missões diárias, conquistas, ranking semanal, analytics e admin (Etapa 3)

- **Status:** aceita · 2026-10-13
- **Fontes:** docs/README.md §3, §5, §8, §10, §11, §13; PROMPT_MESTRE (Etapa 3: "garantir
  idempotência da reivindicação de prêmios"); conversa original ("Desafio dos 7 dias: quem
  consegue construir o maior patrimônio virtual?", "compete com amigos").

## Decisões

- **Calendário:** dia e semana no horário de Brasília (UTC−3 fixo; sem horário de verão desde
  2019 — regra centralizada em `src/lib/time.ts`). Missões viram à meia-noite; semana começa na segunda.
- **Missões diárias (3):** catálogo em código (`economy/missions.ts`). Sempre "colete N vezes" +
  2 sorteadas de forma estável (hash de jogador+dia) entre as elegíveis (faturar, melhorar,
  construir, contratar ajudante, receber AFK, visitar a Cidade). Progresso **somado pelo
  servidor** nos comandos (coleta, upgrade, compra, contratação, presença). Prêmio: ~15 min da
  renda em moedas + **1 diamante** (doc §6: diamantes com fontes gratuitas). Resgate com
  Idempotency-Key + lock da carteira: paga uma única vez; missão de outro dia expira.
- **Conquistas:** 11 marcos (primeiro negócio, praia completa, 1/5/10 ajudantes, nível 10/25/50,
  faturar 10 mil/1 mi/1 bi). Verificadas no servidor a partir do estado e do ledger; prêmio em
  diamantes; resgate idempotente.
- **Ranking semanal ("Desafio dos 7 dias"):** quem **faturou mais com produção na semana**
  (coleta manual + ajudantes). Escolhido no lugar de "patrimônio total" para que jogadores novos
  possam competir toda semana. Top 50 + posição do jogador. Calculado direto do ledger
  (índice `reason, created_at`); snapshots semanais e prêmios de fim de semana: futuro.
- **Ledger usa o relógio do servidor da aplicação** (`createdAt` explícito) — o mesmo das regras.
- **Analytics (§13):** `analytics_events`; o servidor registra os eventos econômicos
  (player_created, session_started, business_purchased/upgraded, production_collected,
  manager_hired, mission_claimed, achievement_claimed, tutorial_completed); o jogo só pode
  enviar eventos de interface de uma lista fechada (tutorial_started/step/skipped, screen_view,
  crash). Sem dados pessoais nas propriedades.
- **Painel admin (§3):** `admin/` React + Vite, **somente leitura** (visão geral com DAU, novos,
  tutorial, retenção D1 aproximada, moedas/diamantes em circulação, eventos 24 h; jogadores;
  ledger do jogador; eventos). Rotas `/api/admin/*` com `Authorization: Bearer ADMIN_TOKEN`
  (comparação em tempo constante); sem token configurado, desligadas. Em `npm run dev` local o
  painel lê o token do `backend/.env` para entrar direto; o build de produção não embute token.
  Produção: nginx serve o painel e repassa `/api` (mesma origem, sem CORS).

## Pendências

- Ícones definitivos de Missões, Ranking e Diamante (hoje desenhados em código — placeholder).
- Prêmios de fim de semana do ranking e "batalha entre amigos" (precisam de amigos/convites).
