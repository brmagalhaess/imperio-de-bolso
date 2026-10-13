# Império de Bolso — documentação de desenvolvimento

## 1. Visão
Jogo mobile idle tycoon isométrico 2D, gratuito, Android primeiro e iOS depois. Jogador começa com 100 moedas virtuais e constrói negócios, evolui gerentes, completa missões e disputa rankings. Sem saque, aposta ou conversão para dinheiro real. Meta comercial de R$ 10 mil mensais é hipótese, não garantia.

## 2. Princípios
Sessões de 3–8 minutos; progresso perceptível; tutorial em menos de cinco minutos; anúncios apenas recompensados; compras opcionais; economia validada no servidor; controles acessíveis; retrato 9:16; suporte a dispositivos modestos.

## 3. MVP
- Cidade com 10 lotes e mapa navegável por toque.
- Dez negócios com compra, upgrade, ciclos de produção e coleta.
- Gerentes automatizam produção e habilitam ganhos offline limitados a quatro horas.
- Autenticação guest com possibilidade de vincular conta.
- Três missões diárias, conquistas simples, ranking semanal.
- Painel administrativo básico e eventos analíticos.
- Anúncios de teste recompensados e compra sandbox, sem cobrança real.
- Build Android para teste fechado; iOS após validação.

## 4. Versão completa
Quatro bairros ou mais, 50+ negócios, prestígio, imóveis, redes de lojas, sinergias, eventos, temporadas, passe VIP, cosméticos, amigos, visitas, corporações, idiomas pt-BR/en-US/es-ES e ferramentas de LiveOps. Recursos pós-MVP entram por métricas e prioridade, não todos de uma vez.

## 5. Loop
Abrir jogo → apurar produção no servidor → coletar → concluir missão → comprar ou melhorar negócio → ver mudança visual → sair → retornar. Progressão não depende de anúncios.

## 6. Economia
Moedas: produção e missões; gastos em negócios e upgrades. Diamantes: cosméticos e conveniência, com algumas fontes gratuitas. Lucro por ciclo = receita bruta − custo operacional. Custo de upgrade nível n = arredondar(base × 1,15^(n−1)); receita = arredondar(base × 1,12^(n−1)). Fórmulas iniciais configuráveis e sujeitas a balanceamento. Usar BIGINT para saldos.

| Negócio | Custo | Lucro/ciclo | Duração |
|---|---:|---:|---:|
| Água | 100 | 10 | 10 s |
| Pipoca | 500 | 40 | 20 s |
| Sorveteria | 2.000 | 150 | 30 s |
| Lanchonete | 8.000 | 600 | 45 s |
| Mercadinho | 25.000 | 1.800 | 60 s |
| Restaurante | 80.000 | 5.000 | 90 s |
| Supermercado | 250.000 | 14.000 | 120 s |
| Academia | 700.000 | 35.000 | 180 s |
| Hotel | 2.000.000 | 100.000 | 240 s |
| Shopping | 8.000.000 | 350.000 | 300 s |

## 7. Produção offline e antitrapaça
Tempo decorrido = clamp(hora_servidor − ultima_liquidacao, 0, 4h). Ciclos = floor((tempo + segundos_restantes)/duracao_ciclo). Creditar lucro em transação ACID, registrar ledger e atualizar estado atomicamente. Não confiar em relógio, saldo ou conquistas enviados pelo cliente. Usar chave idempotente, locks e controle de versão para impedir duplicação.

## 8. Telas
Splash/boot; tutorial; cidade; painel do negócio; missões; conquistas; ranking; loja; perfil; configurações; resumo offline; erro de rede. Cada tela deve contemplar loading, vazio, erro, sucesso, contraste e tamanho de toque.

## 9. Arquitetura
Monorepo: `game/` Godot 4 GDScript; `backend/` Node.js LTS + TypeScript + Fastify/Express + Prisma; `admin/` React + TypeScript; `shared/contracts/`; `infrastructure/` Docker Compose e Dockploy; `docs/`; `.github/workflows/`; `AGENTS.md`. PostgreSQL persistente; Redis apenas quando justificado. API é autoridade econômica.

## 10. Banco de dados
`players(id, guest_id, display_name, created_at)`; `player_wallets(player_id, coins BIGINT, gems BIGINT, version)`; `wallet_ledger(id, player_id, currency, delta, reason, idempotency_key UNIQUE)`; `business_definitions(id, slug, cost, revenue, operating_cost, cycle_seconds, config)`; `player_businesses(player_id, business_id, level, manager_unlocked, carry_seconds, last_settlement_at)`; `missions`; `player_missions`; `leaderboard_snapshots`; `purchase_receipts(store, transaction_id UNIQUE, sku, status)`; `subscriptions`; `game_config_versions`; `analytics_events`.

## 11. API REST v1
`POST /auth/guest`; `POST /auth/link`; `GET /player/state`; `GET /businesses`; `POST /businesses/purchase`; `POST /businesses/upgrade`; `POST /production/collect`; `GET /missions`; `POST /missions/claim`; `GET /leaderboard`; `GET /store/catalog`; `POST /purchases/verify`; `GET /config`. Todos sob `/api/v1`. JSON, UTC ISO 8601, validação de schemas, erros padronizados, Idempotency-Key em comandos econômicos.

## 12. Monetização
MVP: anúncios recompensados opcionais e integração de compras somente sandbox. Pós-MVP: passe R$14,90/mês e cosméticos/pacotes. Exemplo de receita bruta: 5.000 DAU × 2 anúncios/dia × 30 ÷ 1.000 × RPM R$8 = R$2.400; 400 assinantes × R$14,90 = R$5.960; 100 compras × R$19,90 = R$1.990; total R$10.350/mês antes de taxas, impostos, infraestrutura, aquisição e pessoal. Não é previsão.

## 13. Analytics e metas de validação
Eventos: tutorial_started/completed, business_purchased/upgraded, production_collected, mission_claimed, rewarded_ad_completed, purchase_verified, session_started, crash. Hipóteses iniciais: retenção D1 ≥30%, D7 ≥10%, tutorial concluído ≥75%, sessões sem crash ≥99,5%. Escalar marketing só quando CAC e LTV líquido forem mensuráveis.

## 14. Segurança, privacidade e publicação
Tokens expiráveis, TLS, secrets fora do Git, backups testados, logs sem PII, verificação server-side de recibos, reembolso/cancelamento, exclusão de conta, LGPD, classificação etária, política de privacidade, consentimento publicitário quando exigido e revisão das regras atuais Google Play/App Store antes da submissão.

## 15. Cronograma de MVP — 13 semanas
Semana 1: repo, ADRs, CI, design base e compose. Semanas 2–3: guest, economia, ledger e testes. Semanas 4–5: cidade, 3 negócios e tutorial. Semanas 6–7: 10 negócios, gerentes, offline e missões. Semanas 8–9: ranking, telemetria, admin e segurança. Semanas 10–11: sandbox de compras/anúncios, QA e build. Semanas 12–13: teste fechado, correções e decisão de lançamento.

## 16. Roadmap posterior
V1.1: prestígio e segundo bairro. V1.2: temporadas, passe, cosméticos e idiomas. V1.3: amigos, visitas e compartilhamento. V2.0: imóveis, cadeias produtivas, corporações e LiveOps.

## 17. Custos estimados
MVP majoritariamente próprio: R$3 mil–R$20 mil em arte, áudio, ferramentas, dispositivos e publicação, excluindo horas próprias. Terceirizado: R$40 mil–R$150 mil+. Infra: R$100–R$800/mês no início. Teste de aquisição: R$1 mil–R$5 mil depois de instrumentar métricas. Faixas indicativas, não cotações.

## 18. QA e definição de pronto
Testes de compra e upgrade concorrentes; idempotência; offline com relógio adulterado; reconexão; saldo nunca negativo; recibos inválidos/repetidos; backup/restore; responsividade; acessibilidade; build Android. Cada entrega exige código executável, testes rodados, documentação, migrações, `.env.example` e relato honesto de bloqueios.

## 19. Critérios de aceite do MVP
Jogador cria conta guest, compra e evolui 10 negócios, recebe ganhos offline sem duplicar, conclui tutorial/missões, visualiza ranking e executa build Android de teste com analytics e monetização sandbox. Teste fechado com jogadores reais precede lançamento público.

## 20. Riscos e decisões
Riscos: escopo, arte, retenção baixa, inflação da economia, fraude e mudanças nas lojas. Decisões pendentes: direção de arte final, dispositivos mínimos, orçamento, provedores de analytics, contas de desenvolvedor e calendário de produção.


## Complemento obrigatório: publicação e operação

Leia `PLANO_PUBLICACAO_INFRA_MONETIZACAO.md` antes de desenvolver integrações de plataforma. Inclui Apple Developer/Xcode, Google Play, AdMob, VPS/Dockploy, Git, landing page e checklist de lançamento.


## Integração visual obrigatória — Higgsfield + Codex + Godot
Leia `docs/GUIA_ARTE_HIGGSFIELD.md` e mantenha `docs/ASSET_CATALOG.csv`. Higgsfield produz imagens; Codex prepara, versiona e integra sprites em Godot 4. Não trocar o motor por outra tecnologia. Primeiro crie um piloto visual (carrinho de água com três evoluções, pisos, árvore, banco e vendedor), valide perspectiva, escala, transparência e performance numa cena jogável e peça aprovação antes de gerar em lote. Para cada asset registre prompt, referência, proveniência, dimensões, status de direitos comerciais e arquivo integrado. Verifique se a conexão Higgsfield está realmente acessível no ambiente Codex. Antes de gastar créditos, informe custo e solicite autorização. Se indisponível, use placeholders identificados e prossiga com a lógica. Não considere imagens isoladas como funcionalidade pronta; exija importação e teste em Godot. Atualize o status de implementação após cada lote.

## Repositório já criado
O usuário informou que criou o repositório "no Google", mas ainda não informou URL nem confirmou se se refere a GitHub ou outro serviço. Inspecione o remote existente (`git remote -v`) antes de configurar CI/CD. Não invente URL, não sobrescreva branches e não execute push/deploy sem autorização. Use `main`, branches `feature/*` e backend em pasta própria, nunca branch permanente para servidor.
