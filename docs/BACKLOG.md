# Backlog — Império de Bolso

Etapas conforme `docs/PROMPT_MESTRE_CODEX.md`. Marque `[x]` só com teste executado.

## Etapa 0 — Fundação
- [x] Inventário do ambiente macOS (Godot, JDK, Android SDK/NDK, Xcode, Node, Docker) — `docs/SETUP.md`
- [x] Monorepo `game/ backend/ shared/contracts/ infrastructure/ docs/ .github/workflows/`
- [x] `AGENTS.md`, `CLAUDE.md`, ADRs 0001–0003, `DECISOES.md`, `OPEN_QUESTIONS.md`
- [x] Docker Compose local (PostgreSQL 17 + API opcional) e Dockerfile da API
- [x] Prettier + typecheck no backend; executor de testes no Godot
- [x] CI GitHub Actions (backend + jogo) — escrito; **roda só após o primeiro push**
- [ ] Branch `develop` no remoto (aguarda autorização de push)
- [ ] Build mínimo instalável Android (APK debug) e iOS (Xcode + iPhone) — ver bloqueios
- [ ] Landing provisória "Em breve" (Next.js)

## Etapa 1 — Primeira fatia jogável
- [x] Prisma: players, wallets, ledger, business_definitions, player_businesses, idempotency
- [x] `POST /auth/guest` (criar/retomar convidado, JWT curto)
- [x] `GET /player/state`, `GET /businesses`
- [x] `POST /businesses/purchase`, `/businesses/upgrade`, `/production/collect`
- [x] Testes: saldo insuficiente, duplicação, concorrência, idempotência, tempo forjado
- [x] Godot: cidade isométrica com 10 lotes, saldo, compra, upgrade, coleta via API
- [x] Arte piloto Higgsfield integrada (carrinho ×3 níveis, grama, asfalto, calçada, árvore, banco, vendedor)
- [x] ~~Arte piloto v1~~ substituída pela direção visual v2 (ADR 0004)
- [x] Mockups da tela (A/B/D escolhidos) e arte da Ilha da Praia (4 negócios × 3 níveis, UI, personagens)
- [x] Cena da Ilha jogável: bolha de coleta, "+N", clientes andando, interface do mockup B
- [x] Aprovação visual da Ilha pelo titular ("até melhor do que imaginei")
- [x] Coleta pela moeda sem abrir painel; menus Construir/Mapa no padrão do jogo
- [x] Fase 2: Cidade-maquete (mockup D) com os 6 negócios + desbloqueio no servidor + Mapa
- [ ] Loja, Perfil e Configurações (hoje "em breve")
- [x] Construir: só o mapa atual e só o que falta construir (pedido do titular)
- [ ] Rate limiting na API (`@fastify/rate-limit`)

## Etapa 2 — MVP gameplay
- [x] Ajudantes (gerentes): contratação, custo no catálogo e liquidação automática
- [x] Ganhos offline até 4h (clamp, carry_ms) + tela "Bem-vindo de volta!"
- [x] Testes de relógio adulterado, falha de rede e retomada
- [x] Tutorial (< 5 min) com seta, deduzido do estado do servidor
- [x] Reconexão automática com aviso; comandos repetem com a mesma chave
- [x] Prédios reagem visualmente ao nível (3 artes por negócio)
- [ ] Sons e efeitos sonoros (sem assets ainda)
- [ ] Confirmar com o titular o preço dos ajudantes
- [x] Tela Ajudantes (ver e contratar por mapa) e AFK por mapa (ADR 0006)
- [ ] Arte própria dos ajudantes (1 por negócio) e ícone do botão Ajudantes

## Etapa 3 — Retenção
- [ ] Missões diárias (3), conquistas simples, ranking semanal
- [ ] Eventos de analytics (§13) e tabela `analytics_events`
- [ ] Painel admin React mínimo (`admin/`)
- [ ] Reivindicação de prêmios idempotente + testes de integração

## Etapa 4 — Monetização sandbox
- [ ] Loja: **auto-coleta no mapa aberto** (liga `players.auto_collect`; forma/preço a definir — ADR 0006)
- [ ] Loja: **pacotes de horas de coleta** (ex.: +2h de produção na hora, por mapa)
- [ ] Anúncio recompensado para dobrar o AFK ao voltar (conversa original)
- [ ] ADR do plugin AdMob para Godot (Android/iOS), IDs de teste, SSV com assinatura
- [ ] Contratos IAP (Apple/Google), mocks, verificação de recibo, revogação/reembolso
- [ ] `POST /purchases/verify`, `GET /store/catalog`

## Etapa 5 — Beta Android
- [ ] Keystore de release (fora do Git), AAB assinado, teste em aparelho real
- [ ] Deploy staging no Dockploy, backups e restauração testada
- [ ] QA, segurança, teste fechado

## Etapa 6 — Versão completa (após validação)
Prestígio, bairros, 50+ negócios, imóveis, eventos, temporadas, passe, cosméticos, social,
idiomas e LiveOps — divididos em versões com critérios de aceite próprios.
