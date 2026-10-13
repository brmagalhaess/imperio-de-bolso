# Status de implementação

Também cumpre o papel de `docs/STATUS.md` citado no adendo do prompt mestre.

## 2026-10-13 — Etapa 4: Loja, anúncios recompensados e compras em sandbox (ADR 0008)

Revisados antes: docs/README.md §12, PROMPT_MESTRE (Etapa 4, adendo 4–5), plano §23, conversa.
- **Servidor:** catálogo; compras com diamantes (auto-coleta 24h/7d, turbo 1h/4h do mapa);
  compras em dinheiro verificadas por provedor (mock em dev; google/apple → 501 explícito),
  recibos únicos, VIP como assinatura, **reembolso que revoga** (sem saldo negativo, falta
  registrada), restauração; anúncios com sessão no servidor, **SSV do AdMob com assinatura
  verificada**, limites diários, "dobrar ganhos" uma vez por resumo. Mock recusado em produção.
  Migração `*_store_sandbox` (auto-coleta vira validade; preserva quem tinha). **87 testes**
  (inclui SSV com chaves ECDSA reais geradas no teste e assinatura adulterada recusada).
- **Jogo:** Loja (grátis/anúncio, auto-coleta, turbo, diamantes, VIP, restaurar) com cartões
  atualizados no lugar; confirmação "COMPRA DE TESTE"; "ANÚNCIO DE TESTE" de 5 s; "Assistir e
  dobrar" no resumo; tocar nos diamantes abre a Loja. Unitários 55/55; integração 85/85.
- **Plugins verificados:** AdMob (poingstudios v5.1.0), Google Play Billing (godot-sdk-integrations
  3.3.0), StoreKit 2 (godot-sdk-integrations). **Bloqueio:** contas Play Console/App Store
  Connect/AdMob e aparelho físico (ação do titular).
- **A confirmar:** preços em diamantes e benefícios do VIP.

## 2026-10-13 — Etapa 3: missões, conquistas, ranking, analytics e painel admin (ADR 0007)

Revisados antes: docs/README.md (§3, §5, §8, §10, §11, §13), PROMPT_MESTRE (Etapa 3) e a
conversa original (Desafio dos 7 dias, competir com amigos).
- **Servidor:** missões diárias (3, Brasília) com progresso somado nos comandos e resgate
  idempotente (moedas + 1 diamante); 11 conquistas com diamantes; ranking semanal por
  faturamento de produção (top 50 + minha posição); analytics no servidor + eventos de interface
  com lista fechada; ledger com relógio da aplicação; rotas admin somente leitura com token.
  Migração `*_retention`. **73 testes** (missões estáveis, resgate único com 5 cliques
  simultâneos, virada de dia/semana, conquistas, ranking, analytics, admin 401/200, config).
- **Painel admin (`admin/`):** React + Vite; visão geral, jogadores, ledger do jogador, eventos.
  Docker (nginx com proxy `/api`), serviço no compose (`--profile api`, porta 8080) e job no CI.
  Verificado no navegador com dados reais e na pilha Docker (200 com token, 401 sem).
- **Jogo:** botões laterais **Missões** (selo com prêmios a resgatar) e **Ranking**; contador de
  diamantes; Perfil com conquistas; cartões atualizam no lugar ao resgatar; eventos de tutorial.
  Unitários 49/49; integração 71/71 (missões, conquistas e ranking reais). Capturas conferidas.
- **Placeholder:** ícones de Missões/Ranking/Diamante desenhados em código.
- **Decisões a confirmar:** ranking por faturamento semanal (não patrimônio total); prêmio das
  missões (~15 min de renda + 1 diamante).

## 2026-10-13 — AFK por mapa e tela de Ajudantes (pedido do titular, ADR 0006)

- **Regra nova:** no mapa aberto a coleta é manual; ajudantes produzem AFK fora do mapa (outro
  mapa ou jogo fechado), 4h por mapa, pagos ao voltar. Auto-coleta no mapa e pacotes de horas
  ficam para a Loja (Etapa 4). Desvio consciente da doc §3, registrado no ADR.
- **Servidor:** `POST /presence` (substitui `/production/settle`), presença expira em 45 s,
  colunas `current_district`, `last_seen_at`, `auto_collect`; migração devolve ajudantes ao
  manual. 56/56 testes (Praia produz enquanto joga na Cidade, jogo fechado, teto por mapa,
  auto-coleta, relógio, concorrência, replay).
- **Jogo:** botão **Ajudantes** (contratar/contratado/travado por mapa), Mapa mostra o AFK
  esperando, resumo por mapa, sinal de presença a cada 15 s. Executor de testes agora reprova
  erro de script dentro de subseções. Unitários 37/37; integração 57/57.
- **Arte dos ajudantes (autorizada, US$0,26):** 10 ajudantes próprios (2 folhas Grok com o
  estilo dos personagens) + ícone do botão. Aparecem na tela de Ajudantes e **em pé ao lado do
  negócio** quando contratados. Recorte de folhas agora separa figuras encostadas.
- **Correção (pedido do titular):** contratar na tela de Ajudantes reabria a janela inteira (ela
  piscava e os preços dos outros trocavam de cor, parecendo mudar de valor). Agora os cartões são
  atualizados no lugar, o botão fica travado durante o pedido, sem saldo o botão laranja só
  esmaece (preço igual) e o aviso que cobria a janela virou um pulinho no próprio botão.
  Teste de regressão + captura real quadro a quadro (brilho constante, sem piscar).

## 2026-10-13 — Etapa 2: ajudantes, offline 4h, tutorial, reconexão

Revisados antes: docs/README.md (§2, §3, §7, §8, §18), PROMPT_MESTRE (Etapa 2) e a conversa original.
- **Servidor:** ajudante por negócio (`/managers/hire`), liquidação com teto de 4h e sobra em ms
  (`/production/settle`, função pura `economy/offline.ts`), liquidação antes de melhorar,
  `MANAGER_ACTIVE` na coleta manual, `/tutorial/complete`. Migração renomeia `carry_seconds` →
  `carry_ms` (sem perda), adiciona `manager_cost` e `tutorial_completed_at`. ADR 0005.
- **Jogo:** botão "Contratar ajudante" no painel; lote com ajudante mostra rostinho + anel verde e
  "+N" a cada liquidação (15 s); "Bem-vindo de volta!" com o total offline e aviso do teto;
  tutorial com seta (comprar → coletar → melhorar → contratar), embaixo para não cobrir moedas;
  aviso "Sem conexão · reconectando…" com nova tentativa a cada 5 s.
- **Pedido do titular:** Construir mostra só o mapa atual e só o que ainda não foi construído;
  com tudo construído, sugere ir para o próximo distrito.
- **Testes:** backend 52/52 (19 novos: offline por propriedade, 4h, relógio voltando,
  concorrência, replay, upgrade com ajudante, tutorial); jogo unitários 31/31; integração 51/51
  (inclui queda e volta do servidor). Capturas reais: tutorial, resumo offline, ajudantes,
  Construir filtrado.
- **Decisão a confirmar:** preço do ajudante (~4× o negócio; água 150).
- **Fora da etapa:** anúncio para dobrar ganhos offline (Etapa 4); missões/ranking (Etapa 3).

## 2026-10-13 — Fase 2: Cidade-maquete + ajustes pedidos

- **Coleta pela moeda** não abre mais o painel do negócio (pedido do titular).
- **Menus Construir e Mapa** refeitos no padrão do jogo: janela modal centralizada, faixa de
  título, cartões com imagem do negócio/distrito e botões cartoon (`menu_modal.gd`).
- **Cidade:** cenário (mockup D sem prédios) + 6 negócios × 3 níveis; Mapa alterna Ilha ↔ Cidade
  com fade; lotes da cidade mostram "Complete a praia" até liberar.
- **Servidor:** coluna `district`, regra `DISTRICT_LOCKED`, `districts[]` no estado (migração
  `*_business_district`); contrato atualizado.
- **Arte:** 2 testes + 17 prédios + 5 refeitos; gasto acumulado **US$5,01** (teto US$5,53).
  Catálogo regerado por `tools/art/build_catalog.py` (84 linhas, 47 em uso).
- **Testes:** backend 33/33 (3 novos de distrito); jogo unitários 24/24; integração 35/35;
  roteiro `tests/demo_runner.tscn` com capturas de coleta, Construir, Mapa, Cidade e painel.
- **Não validado:** APK com o visual novo; toque real em aparelho.

## 2026-10-12 — Direção visual v2: Ilha da Praia (Fase 1 jogável)

- **Por quê:** o titular rejeitou o visual v1. Referências originais (conversa ChatGPT): Idle Town
  Billionaire + SimCity/Township, começo na praia, cartoon vibrante. Decisão em ADR 0004.
- **Mockups (US$0,24):** 4 telas-conceito; escolhidos cena A + interface B + cidade D.
- **Arte da ilha (Grok Image 2.0 com o mockup como referência):** cenário da ilha vazia, 4 negócios
  × 3 níveis, placa de cadeado, guarda-sol, 6 personagens e 7 ícones de interface.
  Gasto acumulado de arte: **US$3,13** (teto autorizado US$4,15). 3 gerações falharam/moderadas
  sem cobrança. Testes que não serviram (remix Ideogram, ilha remixada) estão no catálogo.
- **Jogo:** nova cena com a ilha fixa preenchendo a tela, lotes com placa/nome/preço, arte por
  nível (1–9/10–24/25+), bolha de moeda tocável que coleta, "+N" subindo, clientes andando,
  vendedor ao lado do carrinho, pulinho ao comprar/evoluir; interface do mockup B (avatar,
  saldo, renda/s, Construir/Loja/Mapa/Perfil, painel do negócio, lista Construir, Mapa).
  Loja/Perfil/Configurações mostram "em breve". Fonte Fredoka (OFL).
- **Backend:** `lanchonete` → `quiosque_coco` (migração), nomes "Carrinho de Pipoca".
- **Testes:** backend 30/30; jogo unitários 24/24; integração com API 35/35; roteiro de
  demonstração (`tests/demo_runner.tscn`) com capturas reais de coleta, painel e lista.
- **Pendente:** Fase 2 (Cidade-maquete, ~US$2,40, aguarda aprovação); APK não regerado após v2;
  termos de uso comercial da API Higgsfield; aprovação visual do titular.

## 2026-10-12 — Piloto de arte Higgsfield (integrado)

- **Acesso:** o MCP Higgsfield (conta do app, 0,06 crédito) não enxerga o saldo da plataforma de
  API (open.higgsfield.ai, US$26). Geração feita pela **API oficial** com `HF_KEY` no `.env`
  (fora do Git), script `tools/art/hf_generate.mjs` com teto de gasto e idempotência.
- **Custo autorizado:** até US$1,30. **Gasto real: US$1,212** (23 requisições únicas, todas
  concluídas, sem cobrança duplicada — conferido no `tools/art/generations.jsonl`).
- **Fase 1 (estilo):** 3× Ideogram 4.0 vs 3× Soul v2 do carrinho nível 1. Escolhido Ideogram v03
  (perspectiva isométrica, contorno discreto, fundo limpo). Soul descartado (sombra/ângulo/contorno grosso).
- **Fase 2:** carrinho nível 2 e 3 (remix do nível 1 aprovado), árvore, banco, vendedor,
  texturas de grama/asfalto/calçada portuguesa e composição de referência do bairro.
- **Tratamento:** `tools/art/process_assets.py` remove fundo (flood fill da borda), recorta e
  salva em 2×; texturas viram losangos 2:1. Originais em `game/assets/source/` (`.gdignore`).
- **Integração:** `scripts/city.gd` desenha pisos texturizados, decoração ordenada por
  profundidade e o carrinho por faixa de nível (1–9, 10–24, 25+) com o vendedor ao lado.
  Demais negócios seguem com blocos PLACEHOLDER.
- **Testes:** unitários do jogo 21/21 (inclui troca de arte por nível); capturas reais nos
  níveis 1, 12 e 30 sem frestas entre tiles nem halo branco nos recortes.
- **Pendente:** aprovação visual do titular antes de produzir em lote; confirmar termos de uso
  comercial da API Higgsfield; avaliar Git LFS para os originais (69 MB hoje).

## 2026-10-12 — Etapa 0 + primeira fatia da Etapa 1

Branch: `feature/etapa-0-fundacao` (local, ainda sem commit/push — aguarda autorização).

### Objetivo
Fundação do monorepo e um vertical slice jogável: conta convidada, catálogo de 10 negócios,
carteira com ledger, compra/upgrade/coleta no servidor e cidade Godot integrada à API.

### Entregue (executável)
- **Backend** (`backend/`): Fastify 5 + Prisma 7 + PostgreSQL 17.
  - Rotas: `GET /health`, `POST /api/v1/auth/guest`, `GET /player/state`, `GET /businesses`,
    `POST /businesses/purchase`, `POST /businesses/upgrade`, `POST /production/collect`.
  - Economia: BIGINT + `CHECK` no banco, lock por carteira, ledger, `Idempotency-Key`,
    relógio do servidor, fórmulas da doc (ADR 0002). Ciclo manual sem gerente (ADR 0003).
  - Migração inicial + seed do catálogo; Dockerfile (migra, semeia e sobe).
- **Jogo** (`game/`): Godot 4.7.2, retrato 720×1280, GL Compatibility.
  - Autoloads `Api` (cliente HTTP, convidado salvo em `user://`, retry com a mesma chave) e
    `GameState` (estado do servidor, contagem por relógio monotônico).
  - Cidade isométrica 2:1 com 10 lotes, arraste para navegar, toque para selecionar;
    HUD com saldo, painel do negócio, comprar/melhorar/coletar, avisos e tela de erro/repetir.
  - **Arte é PLACEHOLDER** (polígonos desenhados em código), não é a arte final.
  - Preset Android e APK de debug gerado.
- **Infra/Docs**: Docker Compose local, CI GitHub Actions, `AGENTS.md`, `CLAUDE.md`, ADRs,
  backlog, contrato da API, setup, checklist de publicação, perguntas em aberto.

### Testes executados (macOS, 2026-10-12)
| Comando | Resultado |
|---|---|
| `npm test` (backend, PostgreSQL real) | 30/30 passaram (3 execuções seguidas) |
| `npm run typecheck`, `format:check`, `build` | ok |
| `docker compose --profile api up --build` + `GET /health` | ok (migrou, semeou, respondeu) |
| Godot unitários (`test_runner.tscn`) | 17/17 |
| Godot integração com API local (`IMPERIO_TEST_API=1`) | 28/28 (convidado, compra, recusa sem saldo, coleta antecipada recusada, reconexão na mesma conta, cena principal com saldo do servidor) |
| Captura real do jogo (`--write-movie`) | cidade, saldo, painel de compra e negócio comprado com ciclo renderizados |
| Export Android debug | APK 54 MB, `br.com.imperiodebolso.game`, targetSdk 36, arm64+x86_64 |

### Não validado
- **Instalação do APK** em aparelho/emulador (nenhum disponível ainda). Em Android a URL da
  API aponta para `10.0.2.2` (emulador); HTTP sem TLS pode exigir ajuste de *cleartext* no manifesto.
- **iOS**: export/Xcode não testado — falta conectar a conta Apple no Xcode (Team ID).
- **CI**: workflow escrito, mas só roda depois do primeiro push.
- Toque real em tela (testado com mouse emulando toque).

### Bloqueios (dependem do titular)
1. ~~Higgsfield sem créditos~~ — resolvido pela API (ver seção do piloto de arte acima).
2. Conta Apple no Xcode (Settings → Accounts) para o build iOS.
3. Autorização para commit/push e criação da branch `develop` no GitHub.

### Próxima etapa
Etapa 2: gerentes + ganhos offline até 4h com testes de relógio adulterado; tutorial;
rate limiting. Em paralelo, quando houver créditos: piloto de arte Higgsfield integrado no Godot.
