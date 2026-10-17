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
- [x] Sons, efeitos e música de fundo (CC0: Kenney + OpenGameArt) com liga/desliga nas Configurações
- [ ] Confirmar com o titular o preço dos ajudantes
- [x] Tela Ajudantes (ver e contratar por mapa) e AFK por mapa (ADR 0006)
- [x] Arte própria dos ajudantes (1 por negócio) e ícone do botão Ajudantes

## Etapa 3 — Retenção
- [x] Missões diárias (3), conquistas simples, ranking semanal (ADR 0007)
- [x] Eventos de analytics (§13) e tabela `analytics_events`
- [x] Painel admin React mínimo (`admin/`), somente leitura, Docker + CI
- [x] Reivindicação de prêmios idempotente + testes de integração
- [ ] Ícones definitivos de Missões, Ranking e Diamante (hoje placeholder em código)
- [ ] Prêmios de fim de semana do ranking; amigos e "batalha de impérios"
- [x] Editar nome do jogador uma vez, com validação e palavras bloqueadas (moderação no admin: futuro)

## Etapa 4 — Monetização sandbox
- [x] Loja: **auto-coleta no mapa aberto** (diamantes 24h/7d e Passe VIP — ADR 0008)
- [x] Loja: **coleta antecipada** (15 min grátis com anúncio "Hoje: x/5", 1 h e 4 h com diamantes)
- [x] Passe VIP: recompensa diária de diamantes
- [x] Anúncio recompensado para dobrar o AFK ao voltar (conversa original) — sandbox
- [x] Contratos de anúncios (sessão + SSV assinado) e compras (verificação, recibo, revogação, restauração) com mocks
- [x] StoreKit 2 no iPhone (ADR 0022) — falta o contrato de apps pagos da Apple
- [ ] Integrar plugins reais: AdMob, Google Play Billing (bloqueado: contas)
- [x] Verificador Apple (JWS) + App Store Server Notifications V2 (estorno)
- [ ] Verificador Google + RTDN
- [x] Exclusão de conta no jogo e na API (LGPD, ADR 0009)
- [x] Link web de exclusão de conta (landing) — informado na segurança dos dados do Play
- [x] Apple: versão 1.0.0 enviada para revisão (fora da UE)
- [x] Google Play: Produção 1.0.0 enviada para revisão (fora da UE)
- [ ] Apple 1.0.1 (build 5, loja paga, capturas 6,3" e iPhone Duo) — enviar para revisão após o contrato
- [ ] Vincular conta convidada a Google/Apple (`/auth/link`) para recuperar sem o Backup do Android
- [ ] Consentimento (UMP/LGPD), ATT no iOS, app-ads.txt
- [x] ADR do plugin AdMob/IAP para Godot com bloqueio explícito (ADR 0008)
- [x] `POST /purchases/verify`, `GET /store/catalog`

## Etapa 5 — Beta Android
- [ ] Keystore de release (fora do Git), AAB assinado, teste em aparelho real
- [ ] Deploy staging no Dockploy, backups e restauração testada
- [ ] QA, segurança, teste fechado

## Etapa 6 — Versão completa (após validação)
- [x] V1.1 Prestígio "Vender o império" (ADR 0011) e bairros novos (porto, centro — ADR 0010)
- [x] V1.2a Idiomas inglês e espanhol no jogo (ADR 0012)
- [x] Aceleradores de velocidade (ADR 0013) e Turbo na Loja
- [x] Retenção: calendário de 7 dias, baú das missões, ligas semanais, ranking de estrelas,
      evento de fim de semana, missões por fase (ADR 0014)
- [x] Mapas 5–8 com 24 negócios novos (ADR 0016) · iPad habilitado
- [x] Contas vinculadas no servidor + tela (ADR 0015)
- [x] Login com Apple (iOS) no Perfil (ADR 0022)
- [ ] Login nativo Google (Android)
- [ ] V1.2b Temporadas, passe de temporada e cosméticos
- [ ] Fichas das lojas e políticas em inglês/espanhol (lançamento fora do Brasil)
- [ ] V1.3 Amigos, visitas e compartilhamento (depende de vincular conta Google/Apple)
- [ ] V2.0 Imóveis, cadeias produtivas, corporações e LiveOps
Prestígio, bairros, 50+ negócios, imóveis, eventos, temporadas, passe, cosméticos, social,
idiomas e LiveOps — divididos em versões com critérios de aceite próprios.
