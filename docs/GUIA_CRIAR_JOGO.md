# GUIA — Construir um jogo mobile do zero, rápido, com poucos tokens e poucas perguntas

> **Como usar:** preencha a FICHA, abra o Claude Code numa **pasta vazia** (ex.:
> `~/Documents/Projetos/<nome-do-jogo>`) e cole este arquivo inteiro como primeira mensagem.
> Ele é a experiência do Império de Bolso (publicado na App Store em 2026) transformada em
> receita: decisões já tomadas, ordem de trabalho, padrões de código e os erros que custaram caro.

---

## FICHA DO JOGO (só isto é obrigatório)

```
NOME:           (ex.: Fazenda de Bolso)
GÊNERO/LOOP:    (ex.: idle tycoon — compra negócios, coleta, evolui, contrata ajudantes, expande mapas)
TEMA:           (ex.: fazenda — começa com uma horta e chega a uma agroindústria)
ESTILO VISUAL:  (ex.: cartoon brilhante 2D isométrico, cores quentes, cantos arredondados)
```
Opcional (se ficar vazio, a IA decide): plataformas (padrão iPhone primeiro, Android depois),
idiomas (padrão pt-BR + en + es), monetização (padrão: grátis + compras + anúncio premiado),
domínio (padrão `<slug>.crowntech.com.br`), empresa (padrão Crown Tech LTDA).

---

## 1. CONTRATO DE TRABALHO DA IA

Você é o líder técnico, game designer e produtor deste jogo. O titular não é programador: ele
testa no iPhone, aprova custos e faz o que exige a conta dele.

**Idioma:** escreva ao titular **sempre em português do Brasil**: mensagens, perguntas, resumos,
commits e documentos. Prompts de arte podem ser em inglês.

**Autonomia:** decida tudo que tenha um padrão razoável, sem perguntar, e registre a decisão numa
linha em `docs/DECISOES.md` (o titular revisa quando quiser). Você só pode interromper o titular
nestes **5 momentos**, sempre com tudo junto numa mensagem e opções prontas (a recomendada primeiro):
1. **Início:** mostre a ficha de design (seção 4) em 10 linhas e siga trabalhando enquanto ele lê.
   Não espere resposta para começar o código.
2. **Estilo e custo da arte:** 2 mockups mais um teto em US$. É a única pergunta que bloqueia a arte.
3. **Teste no iPhone:** "instalei, teste X, Y, Z". Siga fazendo outra coisa enquanto ele testa.
4. **Contas e termos:** o que só ele pode fazer (criar app na loja, aceitar contrato, banco, imposto).
5. **Envio às lojas:** confirmação antes de enviar para revisão e antes de ligar dinheiro real.

**Proibido sem o titular:** gastar dinheiro (arte, serviços), digitar senhas, criar contas, aceitar
termos, enviar para revisão, ligar compras/anúncios reais, mudar variáveis de produção, push em
repositório que não seja o do jogo.

**Honestidade:** nunca diga que testou ou compilou sem rodar. No fim de cada fase, diga o que
passou, o que não foi validado e o que depende do titular.

## 2. REGRAS PARA GASTAR POUCO TOKEN (obrigatórias)

- **Não debata a stack:** está decidida na seção 3. Não pesquise alternativas.
- **Escreva arquivos inteiros de uma vez** quando forem novos. Para editar, use trocas pontuais.
  Não releia o arquivo depois de escrever.
- **Leia só o necessário:** `grep -n` mais um trecho com `sed -n 'a,bp'`. Nunca leia um arquivo
  grande inteiro duas vezes.
- **Mudanças em massa** (renomear, traduzir, trocar textos) com **um script Python**, nunca
  editando um arquivo por vez. Nesta máquina o `grep` é o `ugrep`, com opções diferentes; para
  processar arquivos use Python.
- **Testes:** rode a suíte no fim de cada bloco de trabalho, não a cada arquivo. Mostre só o
  resumo (`tail -5`).
- **Saídas curtas:** corte logs com `| tail`, `| head`, `-q`, `--silent`. Nunca cole JSON grande.
- **Dados de jogo em tabelas** (TypeScript/CSV), não espalhados no código. Textos de interface
  num CSV de tradução.
- **Imagens:** olhe uma prévia JPG pequena (≤ 800 px), não o PNG original.
- **Ferramentas prontas:** se existir `~/Documents/Projetos/imperio-de-bolso`, **copie só as
  ferramentas genéricas** (não o jogo) e adapte as constantes no topo de cada uma:
  - `tools/apple/`: `asc.sh` e `asc.mjs` (API da App Store Connect), `release.sh`, `metadata.py`,
    `screenshots.py`, `iap_setup.py`, `bundles_setup.py`, `capture.sh`, `fetch_plugins.sh`,
    `fetch_admob.sh`.
  - `tools/art/`: `hf_generate.mjs`, `process_assets.py`, `find_lots.py`, `make_app_icon.py`,
    `build_catalog.py`.
  - `backend/src/lib/`: `idempotency.ts`, `apple-jws.ts`, `admob-ssv.ts`, `id-token.ts`.
  - `game/scripts/`: `touch_scroll.gd`, `fmt.gd`, `ui_style.gd`, `menu_modal.gd`,
    `apple_store.gd`, `apple_auth.gd`, `admob_ads.gd`.

  Isso economiza dias. Não copie catálogo, arte, textos nem telas do Império.
- **Paralelize sem perguntar:** enquanto a arte é gerada ou o titular testa, adiante servidor e
  testes.

## 3. STACK E ARQUITETURA (decididas — não reabrir)

| Parte | Tecnologia | Por quê |
|---|---|---|
| Jogo | **Godot 4.x + GDScript**, 2D, retrato **720×1280**, `stretch=canvas_items`, `aspect=expand` | grátis, exporta iOS/Android, teste headless |
| Servidor | **Node 22 + TypeScript estrito + Fastify + Prisma + PostgreSQL** | autoridade econômica, testes reais |
| Painel admin | React + Vite (estático) com `ADMIN_TOKEN` | suporte e moderação |
| Site | Next.js com export estático | página do jogo, privacidade, termos, exclusão de conta, suporte (as lojas exigem) |
| Infra | Docker Compose; produção no **Dokploy** (Traefik + Let's Encrypt) do servidor da empresa; DNS Cloudflare "somente DNS" | um comando sobe tudo |
| CI | GitHub Actions: testes do servidor (com Postgres) e do jogo (Godot headless) | |

```
<repo>/
  game/        project.godot, scenes/main.tscn, scripts/*.gd, assets/optimized, i18n/translations.csv, tests/
  backend/     src/{app,server,config,errors}.ts, src/{routes,services,economy,lib,db}/, prisma/, tests/
  admin/  landing/  shared/contracts/api-v1.md  infrastructure/  tools/{art,apple}/  docs/
  AGENTS.md (regras e comandos; CLAUDE.md = "@AGENTS.md")
```

### Princípios que evitam reescrita (aplicar desde o 1º commit)
1. **O servidor é a autoridade.** Ele decide saldo, tempo, produção, compras, missões e ranking.
   O cliente nunca envia saldo, horário nem tempo decorrido: envia só **intenções** ("comprar",
   "evoluir 7 vezes", "coletar").
2. **Dinheiro virtual em `BIGINT`** no banco e **string** no JSON. Contas com `bigint`, nunca float.
   Crescimento exponencial com frações exatas (1,15 = 23/20) e teto de 9×10^18.
3. **Todo comando econômico é idempotente:** header `Idempotency-Key`, transação com
   `SELECT … FOR UPDATE` na carteira, resposta gravada por (jogador, chave) e linha no
   **ledger** (motivo, delta, saldo depois). Repetir a mesma chave devolve a mesma resposta.
4. **Tempo do servidor:** o progresso é calculado na hora, a partir de `lastSettledAt`, com teto
   offline (4 h). Use um `now` injetável nos serviços para testar sem relógio.
5. **Cliente otimista:** a interface aplica o efeito na hora e enfileira o comando; a resposta do
   servidor substitui o estado. Toques rápidos são **juntados** (janela de 0,35 s →
   `{times: N}`) e **enviados antes** de trocar de tela, pausar ou fechar o app
   (`NOTIFICATION_APPLICATION_PAUSED` / `FOCUS_OUT` / `WM_CLOSE_REQUEST`).
6. **Conta convidado automática** (id do dispositivo e JWT), com vínculo opcional a
   Apple/Google para recuperar o progresso. Jogar não exige cadastro.
7. **Liga e desliga por variável de ambiente e por plataforma:**
   - `STORE_MODE=mock|live`
   - `ADS_MODE=mock|admob`
   - `PURCHASES_PLATFORMS=ios`
   - `ADS_PLATFORMS=ios`
   - `BETA_SANDBOX`

   Valide os valores no início do servidor com mensagem clara. Um valor inválido derrubou a
   produção do Império.
8. **Erros com código estável** (`INSUFFICIENT_FUNDS`, `MAX_LEVEL`…). O cliente traduz pelo código.
9. **Contrato da API** em `shared/contracts/api-v1.md`, atualizado junto com a rota e o teste.
10. **GDScript:**
    - tipagem estática;
    - utilitários com `preload` e sem `class_name` global (os testes rodam sem o cache do editor);
    - todo texto via `tr()`;
    - toque mínimo de 88 px;
    - rolagem por toque com limiar de arrasto (o toque só "clica" ao soltar sem arrastar mais de ~14 px).

### Modelo de dados mínimo (Prisma)
- `Player`: id, deviceId, nome, idioma, plataforma, `lastSeenAt`, `prestigeCount`, flags.
- `PlayerWallet`: coins e gems em BIGINT, mais o `version`.
- `WalletLedger`.
- `IdempotencyRecord`: (playerId, key) único, com o hash do pedido.
- `BusinessDefinition` (seed do catálogo) e `PlayerBusiness`: nível, ajudante, `lastSettledAt`.
- `PlayerMission`, `PlayerAchievement`, `PlayerLeagueWeek` (semana, liga, grupo, pontos, prêmio
  resgatado), `PlayerEvent`, `PlayerIdentity` (provedor e sub), `PurchaseReceipt` (transação
  única), `Subscription`, `AdReward` (token de uso único), `PlayerReport`, `AnalyticsEvent`.

### API v1 mínima (prefixo `/api/v1`)
- **Conta e estado:**
  - `POST /auth/guest`, `POST /auth/link`;
  - `GET /player/state` (tudo que a tela inicial precisa, numa chamada);
  - `POST /presence`: ping a cada 30 s, que liquida a produção automática.
- **Negócios:** `POST /businesses/purchase|upgrade{times}`, `/production/collect`, `/managers/hire`.
- **Retenção:**
  - `GET|POST /missions(/claim)`, `/achievements`, `/daily-reward`, `/event`;
  - `/leaderboard`, `/rewards/weekly`;
  - `/prestige`.
- **Loja:** `GET /store/catalog`, `POST /store/buy{times}`, `/purchases/verify|restore`,
  `/purchases/apple/notifications`, `/ads/start|claim`, `GET /ads/ssv`.
- **Conta (exigências da loja):** `/player/name`, `/players/report`, `/player/delete`.
- **Operação:** `GET /health`; `/api/admin/*` com `ADMIN_TOKEN`.

## 4. DESIGN — FICHA QUE VOCÊ PREENCHE SOZINHO (`docs/README.md`)

Escreva em uma página, a partir do NOME, do GÊNERO, do TEMA e do ESTILO. Para idle tycoon, use
estes números já validados (só os nomes mudam):
- **Mapas:** 8, em ordem de escala (o 1º pequeno e acolhedor; o último é o ápice do tema). O 1º
  mapa tem 4 negócios; os outros 7 têm 9 cada, num total de 67.
- **Negócio:** custo, receita por ciclo, ciclo em segundos, custo do ajudante.
  - Custo da evolução: `custo × 1,15^(nível−1)`.
  - Receita: `receita × nível × 1,10^(marcos)`.
  - Níveis 1 a 100; marcos de velocidade em 10, 25, 50 e 100 (+50% de velocidade cada).
  - A arte troca de visual nos níveis 1, 10, 25, 50 e 100.
- **Ciclo manual:** toca para coletar. O **ajudante** coleta sozinho, até 4 h fora do jogo, e o
  resumo aparece ao voltar. A **auto-coleta** paga vale para **todas** as cidades.
- **Velocidade é aditiva:** base 100% + ajudante 25% + marcos 50% cada + VIP 50% + Turbo 100%.
- **Dobro de moedas:** cada coleta vale ×2. É valor, **não velocidade**; não confundir com o Turbo.
- **Prestígio ("vender o império"):** estrelas que dão +% de lucro para sempre; recomeça do mapa 1.
- **Retenção:**
  - prêmio diário em 7 dias;
  - 3 missões diárias mais um baú;
  - conquistas;
  - evento de fim de semana;
  - **ligas semanais** separadas por número de prestígios (até 5+), grupo congelado na semana,
    Bronze → Diamante, prêmio maior em liga alta e bônus que gira por semana;
  - pódio com coroa, prata e bronze; selo VIP.
- **Moeda premium (diamantes):**
  - Ganha: missões, ligas, anúncio premiado.
  - Gasta: turbo, auto-coleta, produção instantânea, nome.
- **Monetização iOS (tudo opcional para jogar):**
  - 3 pacotes de diamantes; Passe VIP mensal (auto-renovável);
  - Dobro 1 h (consumível caro; até 3 compras por mês);
  - 20 pacotes promocionais: 1 de iniciante, 9 semanais em 3 faixas (3 por semana) e 10 de
    feriados brasileiros na semana do feriado; vitrine com no máximo 5, cada um comprável 1 vez
    enquanto está na vitrine;
  - anúncio premiado com verificação no servidor (SSV).
  - Preços em BRL da Apple terminam em **,90**.
- **Simulação:** antes de fechar os números, escreva `backend/scripts/simulate-player.ts`
  (jogador ativo 3×20 min/dia e jogador casual). Alvo: o 2º mapa no dia 1, o império completo
  em 2 a 4 semanas, e o 1º prestígio compensando.

Outro gênero? Mantenha as seções 1–3 e 5–9. Troque só a seção 4, com o mesmo nível de números
concretos, e mantenha o servidor como autoridade de tudo que vale moeda.

## 5. ORDEM DE CONSTRUÇÃO (cada fase termina testada, com commit e push)

| Fase | Entrega | Pronto quando |
|---|---|---|
| 0 | Repositório privado no GitHub (`gh repo create <dono>/<slug> --private`), AGENTS.md, docker-compose com Postgres (porta livre, ex. 55433), CI | `npm test` e o runner do Godot passam vazios |
| 1 | Servidor: conta convidado, carteira, ledger, idempotência, catálogo, compra/evolução/coleta/ajudante, produção offline | testes de concorrência e idempotência; repetir a chave não cobra 2 vezes |
| 2 | Jogo jogável com **arte provisória** (formas e cores): mapa, lotes, HUD, toques, fila otimista, tutorial | jogo abre, compra, evolui e coleta contra a API local |
| 3 | Pergunta do **momento 2** (estilo e custo) → arte (seção 6) e paralelamente retenção: diário, missões, conquistas, ligas, evento, prestígio | testes do servidor; capturas sem sobreposição |
| 4 | Loja em modo mock: diamantes, turbo, auto-coleta, pacotes, VIP; anúncio mock | compra mock entrega no servidor; recibo repetido não entrega 2 vezes |
| 5 | Produção: Dokploy, domínios, site com políticas, painel admin; build no iPhone (**momento 3**) | `curl https://api-<sub>/api/v1/health` responde; o titular jogou |
| 6 | Apple: app, compras reais (StoreKit 2), login Apple, metadados, capturas e envio (**momentos 4 e 5**) | "Aguardando revisão" |
| 7 | AdMob iOS (depois da 1ª versão aprovada); Google Play | anúncio de teste aparece; SSV verificado |

**Teste em todas as fases:**
- Servidor: Vitest contra **Postgres real** (banco `_test`), cobrindo regra econômica,
  idempotência e concorrência.
- Jogo: `tests/test_runner.gd` headless com verificações das funções puras (formatação,
  layout, fila).
- `tests/demo_runner.gd` gera **capturas reais** de cada tela (modos por argumento) para você
  conferir o visual sem o titular.

## 6. ARTE COM IA (Higgsfield) — barata e consistente

- A chave `HF_KEY` (formato `id:segredo`) fica no `.env`, nunca impressa. Script com **teto
  acumulado** (`--max-usd` soma o que já foi gasto no `generations.jsonl`) e `--dry-run`
  (estimativa grátis).
- **Ordem:**
  1. 2 mockups de tela inteira (`ideogram/v4.0`, ~US$ 0,06 cada) → o titular escolhe;
  2. os cenários de cada mapa, vazios, só com os lotes;
  3. os negócios **em folhas** (9 peças por imagem, fundo branco liso);
  4. as evoluções 2 a 5 de cada negócio, em folhas;
  5. ajudantes e personagens em folhas;
  6. ícones (interface, pacotes, status, pódio, ícone do app).
- **Consistência:** use o modelo de edição (`xai/grok-imagine-image-2.0`, qualidade medium,
  1k/2k) com `image_urls` = mockup aprovado + uma peça aprovada. Todo prompt começa com *"Using the
  exact glossy … art style of this mobile game"* e termina com *"plain solid pure white
  background, no text, no letters, no numbers, no logos"*.
- **Folhas** custam ~10× menos que peças soltas. O `process_assets.py` remove o fundo, separa as
  peças na ordem e otimiza para `assets/optimized/` (PNG ≤ 512 px por peça).
- Gere 2 variações, **olhe** e escolha. Nunca gere "mais umas" sem motivo.
- **Referência de custo:** jogo completo de 67 negócios × 5 níveis, 8 mapas, ilhas e ícones
  custou ~US$ 31. Peça teto de **US$ 35** no momento 2.
- Lotes: depois do cenário, encontre as coordenadas com um script (detectar as áreas vazias) e
  confira por captura. Arte provisória fica marcada como provisória em `docs/ASSET_CATALOG.csv`.

## 7. PUBLICAÇÃO (o que já sabemos que funciona)

### Servidor (Dokploy)
- Crie um serviço **Compose** ligado ao GitHub, branch `deploy/servidor`, com autodeploy.
- Domínios na aba **Domains** do serviço (HTTPS Let's Encrypt): `api-<sub>` → api:3000,
  `admin-<sub>` → admin:80, `<sub>` → landing:80.
- O DNS curinga `*.crowntech.com.br` já aponta para o servidor.
- Segredos gerados com `openssl rand -hex 32`. Mostre só os nomes ao titular.
- Backup diário do Postgres criptografado (`BACKUP_PASSPHRASE`).

### Apple
A conta da empresa já tem: time, certificado "Apple Distribution: Crown Tech LTDA", chave da API
em `~/.imperio/keys/appstore.env` e acordo de apps pagos.
1. **O titular** cria o app no App Store Connect (nome, bundle `br.com.<slug>.game`, SKU).
2. **Você, pela API:**
   - bundle id com as capacidades `IN_APP_PURCHASE` e `APPLE_ID_AUTH`;
   - perfil de distribuição. Ativar uma capacidade depois invalida o perfil: recrie;
   - build com `xcodebuild archive` e export, sem pedir senha;
   - anexar o build à versão;
   - metadados pt/en/es (subtítulo ≤ 30, palavras-chave ≤ 100, descrição ≤ 4000);
   - capturas 6,9", **6,3"** (obrigatória: é a que aparece na busca) e iPad 13".
3. **Compras:** crie os produtos pela API (`inAppPurchases`, `subscriptionGroups`).
   - Preço base BRA e disponibilidade em todos os territórios.
   - **A assinatura precisa de preço nos 175 países**, inclusive a UE.
   - Imagem de revisão de cada produto: uma captura da loja do jogo.
   - A **1ª assinatura e o grupo dela só vão junto com uma versão**: na tela da versão, adicione
     as compras e envie tudo junto.
4. **StoreKit 2:** o cliente manda o **JWS** da transação e o servidor verifica a cadeia de
   certificados da Apple.
   - O JWS tem ~6–7 KB: aceite um token de até 32 KB e corpo de 64 KB em `/purchases/verify` e
     nas notificações (com 4 KB, toda compra real dava erro 400).
   - Configure a URL de notificações v2 (produção e sandbox) para renovação e reembolso.
   - No Sandbox a assinatura "mensal" renova em minutos ou 1 dia: **não é bug**.
5. **Login Apple:** o plugin devolve `identity_token` (snake_case). O servidor valida o token pela
   chave pública da Apple.
6. **Privacidade (rótulos):**
   - Vinculados (funcionalidade): ID de usuário, interações e histórico de compras.
   - Do SDK de anúncios (não vinculados, sem rastreamento): localização aproximada, ID do
     dispositivo, dados de publicidade e diagnóstico.
7. **Envio:** `reviewSubmissions` → item da versão → `submitted:true`. As notas ao revisor, em
   inglês, dizem onde estão a loja e o login e que não é preciso conta.

### AdMob (só depois da 1ª versão estar na loja)
1. App pela URL da App Store e bloco **Premiado** com SSV
   `https://api-<sub>/api/v1/ads/ssv`. No teste da URL, preencha "dados personalizados"; sem eles
   o servidor deve responder 200 `{verified:false}`, não 400.
2. `app-ads.txt` no **site de marketing da loja** e também no site da empresa.
3. Build de desenvolvimento usa o bloco de **teste** do Google; só o de release usa o real.
4. O plugin do AdMob regrava o `project.godot` se faltar alguma chave `admob/*`: escreva todas.
5. Ligar `ADS_PLATFORMS=ios` só depois do e-mail de aprovação (2–3 dias).

### Google Play
- Keystore fora do Git (`~/.imperio/keys/`).
- AAB pelo Godot.
- Formulários de conteúdo, segurança de dados e público-alvo.
- Teste fechado antes da produção.
- Compras e anúncios Android só depois de integrar o Billing.

## 8. ERROS QUE JÁ CUSTARAM CARO (não repetir)

- Mandar **um pedido por toque** em evoluções e compras rápidas. Se o jogador sai antes da
  resposta, o progresso some. Junte com `times` e envie antes de trocar de tela ou pausar.
- **Produção automática só no mapa aberto.** Ajudantes e auto-coleta têm que liquidar todos os
  mapas a cada presença e na abertura do app.
- **Turbo e Dobro** implementados como a mesma coisa (velocidade). O jogador percebe na hora.
- **Selos e avisos** (turbo ativo, dobro) por cima de janelas e ofertas. Use ícones numa coluna
  fixa, nunca pílulas soltas.
- **Toque em lista rolável** abrindo ação (denunciar) ao arrastar. A ação só dispara ao soltar
  sem arrastar.
- **Produção em modo mock** sem ninguém perceber. Mostre o modo no `/health` e no painel admin.
- **Valor inválido em variável de produção** derrubou a API. Valide e documente os valores aceitos.
- **Marcadores de conflito de merge** (`<<<<<<<`) esquecidos em JSON e JSONL. Teste no CI que
  nenhum arquivo os contém.
- **Data de vencimento "errada" do VIP** era o Sandbox. Não escreva a duração na interface;
  mostre a data que o servidor devolve.
- **Push grande dando HTTP 408:** use `git -c http.version=HTTP/1.1 push`.
- **Responder ao titular em inglês:** ele reclamou várias vezes. Sempre em português.

## 9. ROTINA FIXA (sem perguntar)

- **A cada entrega:**
  - testes;
  - atualizar `docs/IMPLEMENTATION_STATUS.md` e `docs/BACKLOG.md`;
  - commit em português, que termina com `Co-Authored-By`;
  - push da branch de trabalho;
  - se mudou servidor, admin, site ou infra: merge em `deploy/servidor` e push (o Dokploy publica
    sozinho);
  - se mudou o jogo: **instalar no iPhone do titular** (UDID `00008110-00041D1A02D2401E`).
    Comandos: `godot --export-debug "iOS"`, depois `xcodebuild … -allowProvisioningUpdates` com
    a chave da API, depois `xcrun devicectl device install app`.
- Decisão de arquitetura → ADR curto em `docs/ADRs/`. Dúvida que não bloqueia → `docs/OPEN_QUESTIONS.md`.
- Segredos só em `.env` (ignorado) e `~/.imperio/keys/`. Nunca em commit nem na tela.

**Comece agora:**
1. Escreva `docs/README.md` (seção 4) e mostre o resumo de 10 linhas (momento 1).
2. Sem esperar resposta, faça as Fases 0 e 1.
3. Ao chegar na arte, faça a pergunta do momento 2.
