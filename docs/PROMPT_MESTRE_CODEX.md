# PROMPT MESTRE — CODEX | IMPÉRIO DE BOLSO

Atue como líder técnico, game designer e engenheiro full-stack sênior. Sua missão é implementar o jogo mobile **Império de Bolso**, primeiro um MVP jogável e depois a versão completa, usando como fonte de verdade `docs/README.md` (documentação anexada). Se não conseguir ler o arquivo, informe o bloqueio antes de implementar.

## Regras inegociáveis
1. Inspecione o repositório antes de modificar qualquer coisa. Preserve arquivos existentes. Se estiver vazio, inicialize monorepo.
2. Trabalhe em **etapas verticais pequenas e executáveis**, não em uma entrega gigante. Comece a implementar a primeira etapa nesta sessão, se o ambiente permitir.
3. Stack: Godot 4/GDScript para o jogo isométrico 2D retrato; Node.js LTS/TypeScript + PostgreSQL/Prisma para API; React/TypeScript para admin; Docker Compose/Dockploy para backend. Redis só se necessário.
4. O backend é a autoridade de saldos, produção, missões, compras e ranking. Nunca aceite saldo ou tempo offline informado pelo cliente. Use BIGINT, ledger, transações, idempotência, controle de concorrência e testes.
5. Não use segredos no código; crie `.env.example`. Não configure anúncios ou pagamentos reais sem aprovação. Integrações começam com mocks claramente identificados e sandbox.
6. Não alegue que compilou ou testou sem executar os comandos. Se Godot, Docker ou Node não estiver disponível, explique exatamente o que ficou sem validação.
7. Ao terminar cada etapa, atualize `docs/IMPLEMENTATION_STATUS.md` com o que foi entregue, testes executados, arquivos alterados, bloqueios e próxima etapa.
8. Documente decisões arquiteturais em `docs/ADRs/` e dúvidas não bloqueantes em `docs/OPEN_QUESTIONS.md`. Pergunte apenas quando uma decisão impedir trabalho seguro.
9. UI em pt-BR, preparada para i18n. Priorize acessibilidade, telas pequenas, estabilidade e bom desempenho.
10. Nunca apresente placeholders ou mocks como funcionalidades de produção concluídas.

## Estrutura alvo
```
imperio-de-bolso/
  game/                   # Godot 4: project.godot, scenes, scripts, assets, tests
  backend/                # TypeScript, API, Prisma, testes
  admin/                  # React TypeScript
  shared/contracts/       # Schemas e contratos documentados
  infrastructure/         # compose, exemplos de deploy Dockploy
  docs/                   # README.md, BACKLOG.md, ADRs, status
  .github/workflows/      # CI
  AGENTS.md
  .env.example
  README.md
```

## Etapas e critérios de aceite
**Etapa 0 — Fundação:** analisar ambiente e repositório; ler documentação; criar `docs/BACKLOG.md` com épicos e tarefas, `AGENTS.md`, arquitetura, Docker Compose, formatação, testes básicos, CI e instruções de setup. Não criar complexidade desnecessária.

**Etapa 1 — Primeira fatia jogável:** criar PostgreSQL/Prisma, guest auth, catálogo de negócios, carteira e ledger. Implementar `GET /api/v1/player/state`, `GET /api/v1/businesses`, `POST /api/v1/businesses/purchase`, `POST /api/v1/businesses/upgrade`, `POST /api/v1/production/collect`. No Godot, criar cena simples de cidade com carrinho de água, saldo, compra, upgrade e coleta integrados à API. Testar saldo insuficiente, duplicação e concorrência.

**Etapa 2 — MVP gameplay:** 10 negócios, ciclos, gerentes, offline de até 4h validado no servidor, tutorial, feedback visual, persistência e reconexão. Testar relógio adulterado, falhas de rede e retomada.

**Etapa 3 — Retenção:** missões diárias, conquistas, ranking semanal, analytics, painel React mínimo e testes de integração. Garantir idempotência da reivindicação de prêmios.

**Etapa 4 — Monetização sandbox:** contratos para anúncios recompensados e compras in-app; mocks para desenvolvimento; SDKs e validação de recibos apenas quando o ambiente suportar; nunca realizar transações reais. Incluir revogação de benefícios e reembolso no desenho.

**Etapa 5 — Beta Android:** export/build, testes de dispositivo, QA, segurança, backups, documentação de deploy e teste fechado. Corrigir defeitos antes de adicionar recursos.

**Etapa 6 — Versão completa (após validação):** prestígio, bairros, novos negócios, imóveis, cadeias produtivas, eventos, temporadas, passe, cosméticos, amigos, visitas, corporações, idiomas e LiveOps. Dividir em versões independentes com critérios de aceite e migrações seguras.

## Regras de economia
Moedas e diamantes virtuais sem valor monetário ou saque. Configurações de preço e produção ficam em catálogo versionado. Custo de upgrade inicial: `round(base_cost * 1.15 ** (level - 1))`. Produção offline: usar hora do servidor, limite de 4h, ciclos completos, carry de segundos e liquidação transacional. Não permitir saldos negativos ou duplicação. Criar testes de propriedade/limite para fórmulas.

## Contrato de entrega por etapa
Para cada etapa, responda com: (a) objetivo; (b) arquivos criados/alterados; (c) arquitetura e decisões; (d) código realmente implementado; (e) comandos exatos para rodar no Windows/macOS/Linux quando aplicável; (f) testes executados e resultados; (g) limitações; (h) próximo passo. Se houver acesso ao terminal, execute comandos, não apenas sugira.

## Primeira ação agora
1. Leia a documentação e liste requisitos do MVP versus pós-MVP.
2. Examine ferramentas instaladas, estrutura e Git.
3. Crie o plano granular e os arquivos de governança.
4. Implemente **Etapa 0 e a primeira fatia mínima da Etapa 1** até existir API iniciável e projeto Godot abrível, com testes onde o ambiente permitir.
5. Termine com um resumo factual do que funciona, como executar e o próximo incremento.

Não pule diretamente para o jogo completo. O objetivo é entregar o produto completo **por incrementos verificáveis**.


## ADENDO OBRIGATÓRIO — distribuição e produção (outubro/2026)

Antes de codificar, leia `docs/README.md` e `docs/PLANO_PUBLICACAO_INFRA_MONETIZACAO.md`. O objetivo final não é apenas um protótipo: entregar builds publicáveis Android (AAB) e iOS (Xcode archive), backend em VPS via Dockploy, painel administrativo e landing page Next.js.

1. Na Fase 0 faça inventário do ambiente macOS, Xcode, Godot, Android SDK/JDK e Apple signing sem pedir segredos no chat; documente comandos e ações manuais para vincular Apple Developer. Registre as pendências de cadastro no Google Play Console (o proprietário executa pagamento/verificação).
2. Organize monorepo `game/`, `backend/`, `admin/`, `landing/`, `infrastructure/`, `docs/`; branches `main`, `develop`, `feature/*`, com CI e deploy por serviço/caminho. Não use branch permanente de backend.
3. Configure Docker Compose local e stacks Dockploy separadas para staging e produção. Implemente HTTPS, migrations, backup/restauração, logs, healthcheck, segredos fora do Git e deploy automático somente para backend/admin/landing.
4. Faça exportação mínima instalável em iPhone e Android já na Fase 0. Verifique viabilidade real do plugin AdMob em Godot Android/iOS, usando anúncios de teste e SDKs oficiais. Para recompensa em produção use SSV com assinatura validada e idempotência.
5. Implemente compras com Apple IAP e Google Play Billing, verificação backend, restauração e revogação; não invente APIs de plugins. Se não houver plugin mantido, produza ADR com alternativas e bloqueio explícito antes de prometer publicação.
6. Construa landing page responsiva com SEO, pré-cadastro opt-in, suporte, política de privacidade, termos e exclusão de conta. Links para lojas só após URLs reais.
7. Inclua checklist completo App Store Connect/TestFlight e Google Play Console (testes internos/fechados, Data Safety, screenshots reais, classificação etária, anúncios, políticas, assinaturas). Nunca afirme que uma loja aprovou sem confirmação humana.
8. Entregue MVP completo e testado primeiro, depois amplie o jogo por marcos. Mantenha `docs/STATUS.md`, `docs/DECISOES.md` e `docs/PUBLICACAO_CHECKLIST.md` atualizados; documente cada impedimento que depende de conta, certificados ou ação do titular.

Ao iniciar, apresente plano de execução com tarefas, dependências e critérios de aceite; em seguida implemente Fase 0 e o primeiro vertical slice jogável. Não tente implementar tudo em um único commit.


## Integração visual obrigatória — Higgsfield + Codex + Godot
Leia `docs/GUIA_ARTE_HIGGSFIELD.md` e mantenha `docs/ASSET_CATALOG.csv`. Higgsfield produz imagens; Codex prepara, versiona e integra sprites em Godot 4. Não trocar o motor por outra tecnologia. Primeiro crie um piloto visual (carrinho de água com três evoluções, pisos, árvore, banco e vendedor), valide perspectiva, escala, transparência e performance numa cena jogável e peça aprovação antes de gerar em lote. Para cada asset registre prompt, referência, proveniência, dimensões, status de direitos comerciais e arquivo integrado. Verifique se a conexão Higgsfield está realmente acessível no ambiente Codex. Antes de gastar créditos, informe custo e solicite autorização. Se indisponível, use placeholders identificados e prossiga com a lógica. Não considere imagens isoladas como funcionalidade pronta; exija importação e teste em Godot. Atualize o status de implementação após cada lote.

## Repositório já criado
O usuário informou que criou o repositório "no Google", mas ainda não informou URL nem confirmou se se refere a GitHub ou outro serviço. Inspecione o remote existente (`git remote -v`) antes de configurar CI/CD. Não invente URL, não sobrescreva branches e não execute push/deploy sem autorização. Use `main`, branches `feature/*` e backend em pasta própria, nunca branch permanente para servidor.
