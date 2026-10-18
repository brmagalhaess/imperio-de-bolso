# PROMPT — Novo jogo no motor do Império de Bolso

> **Como usar:** abra o Claude Code na pasta `~/Documents/Projetos`, preencha só a **FICHA** abaixo e
> cole este arquivo inteiro como primeira mensagem. A IA cria o projeto, decide o resto sozinha e
> só pergunta o que for de custo ou exigir a sua conta.

---

## FICHA DO JOGO (preencha só isto)

```
NOME:            (ex.: Reino de Bolso)
TEMA:            (ex.: reino medieval — começa com uma barraca de pão na vila e chega a um castelo)
ESTILO VISUAL:   (ex.: cartoon brilhante, cores quentes, isométrico, igual ao Império de Bolso)
```

Opcional (se ficar vazio, a IA deriva do NOME): `PASTA`, `SLUG` (ex.: reino-de-bolso), `BUNDLE`
(ex.: br.com.reinodebolso), `SUBDOMINIO` (ex.: reino → reino.crowntech.com.br).

---

## INSTRUÇÕES PARA A IA (leia tudo antes de começar)

Você é líder técnico e game designer. Vai criar um jogo mobile **novo** reaproveitando 100% do
motor do jogo **Império de Bolso** (já publicado na App Store), trocando só **tema, nomes, textos e
arte**. O motor (Godot 4.7 + API Node/TypeScript/Prisma/PostgreSQL + painel React + site Next.js +
scripts de loja/arte) está pronto e testado: **não reescreva o motor**.

### Regras de trabalho (obrigatórias)
1. **Fale sempre em português do Brasil** com o titular — mensagens, perguntas, resumos. Nunca em inglês.
2. **Decida sozinho** tudo que tiver um padrão razoável e registre em `docs/DECISOES.md`. Pergunte
   **apenas**: (a) aprovação de **custo** (arte no Higgsfield: peça um teto único em US$ no início
   da Fase 3), (b) ações que só o titular pode fazer (criar contas, aceitar termos, dados bancários,
   assinar contratos), (c) antes de **enviar para revisão** nas lojas, (d) escolha entre 2 mockups de
   estilo (uma vez só). Junte perguntas numa única mensagem; nunca pergunte o que dá para decidir.
3. **Economia de tokens:** não releia arquivos grandes inteiros (use `grep -n` e `sed -n 'a,bp'`);
   faça trocas em lote com scripts Python; não cole saídas longas; rode testes no fim de cada fase,
   não a cada arquivo; reaproveite os scripts de `tools/`; não gere arte sem simular o custo antes
   (`--dry-run`); não explore o motor além do necessário — este prompt já diz onde está cada coisa.
4. **Servidor é a autoridade** (saldo, tempo, compras, ranking). Nunca mude isso. Toda mudança de
   regra do servidor tem teste (Vitest contra PostgreSQL real).
5. **Sem segredos no Git.** Chaves em `.env` (ignorado) e `~/.imperio/keys/` (já existem, mesma
   conta Apple/empresa). Nunca imprima chaves.
6. **Não alegue** que testou sem rodar. No fim de cada fase: atualizar `docs/IMPLEMENTATION_STATUS.md`
   e `docs/BACKLOG.md`, commit e push (`main` → depois `deploy/servidor` para o Dokploy publicar).
7. A cada mudança jogável, **instale no iPhone do titular** (UDID `00008110-00041D1A02D2401E`).
8. Texto de interface sempre via `tr()` e em `game/i18n/translations.csv` (pt_BR, en, es).

### Onde ficam as coisas (motor de origem)
- Motor original: `/Users/brunomagalhaes/Documents/Projetos/imperio-de-bolso` (só leitura — **não altere**).
- Guia do repositório: `AGENTS.md` (comandos, regras). Decisões: `docs/ADRs/0001…0026`.
- **Tema** está concentrado em:
  - `backend/src/economy/catalog.ts` — 67 negócios: `[slug, nome, custo, receita, ciclo, ajudante]`
    (Praia 4 + 7 mapas × 9). **Mantenha os números**; troque só os **nomes**.
  - `backend/src/economy/districts.ts` — ids internos dos 8 mapas (**mantenha os ids**).
  - `game/scripts/layout.gd` — `DISTRICTS`: `title`, cenário (`base`), cores, lotes (coordenadas),
    decoração, personagens; `short` (nomes curtos dos mapas).
  - `backend/src/economy/missions.ts`, `achievements.ts`, `prestige.ts`, `services/retention.ts`,
    `game/scripts/tutorial.gd` — textos que citam negócios/mapas.
  - `backend/src/economy/bundles.ts` — 20 pacotes (títulos podem ganhar o tema; preços e conteúdo iguais).
  - `game/i18n/translations.csv`, `tools/apple/store_texts.json` (página da loja pt/en/es),
    `landing/app/page.tsx` + `landing/lib/site.ts` (site), `docs/README.md` (documento do produto).
  - Arte: `game/assets/optimized/<slug>_lv1..5.png` (negócios), `helper_<slug>.png`, `char_*.png`,
    `*_base.jpg` (cenários), `*_expansao.png` (ilhas), `icon_*`, `offer_*`, `status_*`, `rank_*`,
    `badge_vip.png`, `game/assets/app_icon/`. **Os nomes dos arquivos seguem os slugs internos.**
- **Grande economia:** mantenha os **slugs e ids internos** (`agua`, `praia`…) — assim nenhum código,
  teste, rota ou nome de arquivo de arte muda. Só mudam o texto exibido e a imagem.

---

## FASE 0 — Criar o projeto (sem perguntas)

```bash
cd ~/Documents/Projetos
sh imperio-de-bolso/tools/novo_jogo.sh <PASTA> "<NOME>" <SLUG> <BUNDLE> <SUBDOMINIO>
cd <PASTA>
cp ../imperio-de-bolso/.env .env                     # HF_KEY (arte) — não imprimir
cp backend/.env.example backend/.env                 # gere JWT_SECRET: openssl rand -hex 32
```
O script copia o motor sem Git/segredos/arte original (a arte otimizada vem como **placeholder**),
troca nome/bundle/domínios, marca IDs de loja como `PREENCHER_…` e faz o primeiro commit.

Ajustes obrigatórios logo depois:
1. O banco local do jogo novo já usa a porta **55433** (o script trocou), sem colidir com o Império.
2. `npm install` em `backend/`, `admin/`, `landing/`; `docker compose -f infrastructure/docker-compose.yml up -d postgres`;
   `cd backend && npm run db:deploy && npm run db:seed && npm test`.
3. `godot --headless --path game --import && godot --headless --path game res://tests/test_runner.tscn`
   (deve dar **153 verificações, 0 falhas** antes de mexer em qualquer coisa).
4. Plugins nativos (fora do Git): `sh tools/apple/fetch_plugins.sh` e `sh tools/apple/fetch_admob.sh`.
5. Crie o repositório no GitHub (`gh repo create brmagalhaess/<SLUG> --private --source . --push`)
   e a branch `deploy/servidor`.

## FASE 1 — Ficha do tema (você decide, sem perguntar)

Crie `docs/TEMA.md` com:
- **8 mapas** na mesma ordem dos ids (`praia, cidade, porto, centro, industrial, serra, ilha,
  espaco`): título, 1 frase do cenário, paleta (2 cores), clima. O 1º mapa é pequeno e acolhedor;
  o último é o "ápice" do tema.
- **67 negócios** com nome temático, na mesma ordem do `catalog.ts` (o 1º é o mais simples e barato;
  cada mapa cresce em tamanho/luxo; o 1º negócio é o do tutorial). Para cada um: nome curto (≤ 22
  caracteres), descrição visual dos 5 níveis de evolução (1, 10, 25, 50, 100).
- **Ajudante** de cada negócio (1 frase visual) e 6 **personagens** que andam pelos mapas.
- Nome do jogo, subtítulo da loja (≤ 30), slogan, palavras-chave (≤ 100 caracteres), descrição da
  loja em pt/en/es (≤ 4000), textos do site.
Depois aplique os nomes com **um script Python** (catalog.ts, layout.gd `title`/`short`, missões,
conquistas, tutorial, traduções, store_texts.json, site). Rode os testes (servidor e jogo) e commit.

## FASE 2 — Estilo (1 pergunta) e orçamento de arte (1 pergunta)

1. Gere **2 mockups** de tela (Higgsfield, `ideogram/v4.0` ~US$ 0,06 cada) usando como base o job
   `tools/art/jobs/mockups-v2.json` com o tema novo. Mostre os 2 ao titular e pergunte qual estilo segue.
2. **Na mesma mensagem**, peça o teto de custo da arte. Estimativa (referência do Império: ~US$ 31
   no total): cenários 8 + ilhas 7 (~US$ 1,50) · negócios 67 × 5 níveis em folhas (~US$ 20) ·
   ajudantes e personagens em folhas (~US$ 2) · ícones (interface, pacotes, status, ranking, ícone do
   app) (~US$ 2). Sugira **US$ 35**.

## FASE 3 — Arte (Higgsfield → Godot)

Pipeline pronto (ler `tools/art/README.md` só a seção de comandos):
```bash
node tools/art/hf_generate.mjs tools/art/jobs/<lote>.json --max-usd <TETO_TOTAL> --dry-run   # simula
node tools/art/hf_generate.mjs tools/art/jobs/<lote>.json --max-usd <TETO_TOTAL>             # gera
python3 tools/art/process_assets.py      # recorta fundo, separa folhas, salva em assets/optimized
```
- O `--max-usd` é o **total acumulado** do `tools/art/generations.jsonl` (começa zerado no jogo novo).
- Copie os jobs do Império como modelo (mesmos tamanhos/proporções/referências) e troque só o tema:
  `v2-*` (cenários/mockups), `v6-base9*.json` (negócios por mapa), `v6-novos-lv2345.json` (evoluções),
  `v6-expansao*.json`/`v6-ilhota*` (ilhas), `v7-ofertas.json` (20 ícones de pacotes),
  `v7-status.json` (Turbo/Dobro), `v7-ranking.json` (coroa/medalhas/selo VIP). Modelo padrão:
  `xai/grok-imagine-image-2.0` em modo edição com `image_urls` = mockup aprovado + peça aprovada
  (para manter estilo e ângulo); `quality: medium`, `resolution: 1k/2k`.
- **Folhas** (várias peças numa imagem, fundo branco liso) saem ~10× mais baratas que peças soltas;
  `process_assets.py` separa automaticamente (`SHEETS`: lista de nomes na ordem da folha).
- Escreva os prompts em inglês, sempre com: *"Using the exact glossy rounded cartoon art style of this
  mobile game… plain solid pure white background, no text, no letters, no numbers, no logos"*.
- Gere 2 variações, **olhe as duas** (converta para JPG pequeno e abra) e escolha; nunca gere a mais.
- **Coordenadas dos lotes:** depois dos cenários novos, rode `python3 tools/art/find_lots.py` e
  ajuste `lots`/`waypoints`/`camera_center` em `layout.gd`; confira com captura (Fase 4).
- Ícone do app: `python3 tools/art/make_app_icon.py`.
- Registre custos e escolhas em `docs/ASSET_CATALOG.csv` (`python3 tools/art/build_catalog.py`).

## FASE 4 — Conferir no jogo (capturas reais)

```bash
sh tools/apple/capture.sh capturas 1206 2622 docs/lojas/capturas/iphone-6.3     # 8 telas da loja
sh tools/apple/capture.sh capturas 1320 2868 docs/lojas/capturas/iphone-6.9
sh tools/apple/capture.sh capturas 1398 2034 docs/lojas/capturas/iphone-duo-externa
sh tools/apple/capture.sh capturas 2007 2853 docs/lojas/capturas/iphone-duo-interna 1300
sh tools/apple/capture.sh capturas 2064 2752 docs/lojas/capturas/ipad-13
sh tools/apple/capture.sh ofertas 1206 2622 docs/lojas/capturas/compras          # imagem de revisão das compras
sh tools/apple/capture.sh ranking 720 1280 /tmp/ranking                          # conferência
```
Modos do roteiro em `game/tests/demo_runner.gd` (capturas, loja_paga, ofertas, ranking, ilhas,
evolucao). Olhe as imagens: sobreposição de elementos, textos cortados, arte com fundo sobrando.
Instale no iPhone (comando no fim deste arquivo) e peça ao titular para testar.

## FASE 5 — Servidor no ar (Dokploy)

- Dokploy: `https://dokploy.home.crowntech.com.br` → criar projeto `<NOME>` → serviço **Compose**
  ligado ao GitHub `brmagalhaess/<SLUG>`, branch `deploy/servidor`, arquivo
  `infrastructure/docker-compose.prod.yml`, autodeploy ligado.
- **Environment** (gere segredos com `openssl rand -hex 32`, mostre só os nomes):
  `STACK_ENV=production`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `BACKUP_PASSPHRASE`, `ADMIN_TOKEN`,
  `STORE_MODE=live`, `ADS_MODE=admob`, `BETA_SANDBOX=false`. (`PURCHASES_PLATFORMS` padrão `ios`;
  `ADS_PLATFORMS` vazio até o AdMob aprovar.) **Valores aceitos:** `ADS_MODE` só `mock|admob`,
  `STORE_MODE` só `mock|live` — valor errado derruba a API no deploy.
- **Domínios** (aba Domains do serviço, HTTPS Let's Encrypt): `api-<sub>` → `api:3000`,
  `admin-<sub>` → `admin:80`, `<sub>` → `landing:80`. O DNS curinga `*.crowntech.com.br` já aponta
  para o servidor (169.58.235.246): subdomínios novos funcionam sem mexer no Cloudflare.
- Conferir: `curl https://api-<sub>.crowntech.com.br/health`.

## FASE 6 — App Store (Apple)

Conta, time (`HZYY469476`), certificado "Apple Distribution: Crown Tech LTDA", chave da API
(`~/.imperio/keys/appstore.env`) e **acordo de apps pagos** já estão ativos — valem para o jogo novo.
1. **Titular faz** (peça uma vez): App Store Connect → Apps → "+" Novo app (nome, idioma pt-BR,
   bundle `<BUNDLE>.game`, SKU `<SLUG>`). Pegue o **App ID** numérico e troque
   `PREENCHER_APP_ID_APPLE` nos arquivos (o `novo_jogo.sh` lista onde).
2. **Você faz pela API** (`sh tools/apple/asc.sh METODO caminho [json]`; colchetes na URL como
   `%5B` `%5D`): registrar bundle id (`POST /v1/bundleIds`) e capacidades `IN_APP_PURCHASE` e
   `APPLE_ID_AUTH`; criar o perfil de distribuição com o **nome que o `release.sh` usa**
   (`"<NOME sem acento> App Store"`, tipo `IOS_APP_STORE`, certificado de distribuição) e instalá-lo
   em `~/Library/MobileDevice/Provisioning Profiles/<uuid>.mobileprovision`. Se ativar uma
   capacidade depois, **o perfil fica inválido**: recrie.
3. Textos e dados: `python3 tools/apple/metadata.py` (cria a versão de `store_texts.json` se não
   houver). Capturas: `python3 tools/apple/screenshots.py` (6,9", **6,3"** — obrigatória, é a que
   aparece na **busca** —, iPhone Duo e iPad).
4. Build: `sh tools/apple/release.sh <N>` (N sempre maior que o anterior). Anexar o build à versão
   pela API (`PATCH /v1/appStoreVersions/<id>/relationships/build`).
5. Compras: `python3 tools/apple/iap_setup.py` (diamantes + Passe VIP) e
   `python3 tools/apple/bundles_setup.py` (20 pacotes; lê `bundles.ts`) + produto do Dobro (ver como
   foi feito no histórico do Império: consumível `double_1h` R$ 129,90). Depois
   `--screenshots docs/lojas/capturas/compras/<imagem>.jpg` para a imagem de revisão.
6. **Privacidade do app** (no site, aprovada pelo titular): ID de usuário, interações, outros
   conteúdos (vinculados, funcionalidade); histórico de compras (vinculado); localização aproximada,
   ID do dispositivo, dados de publicidade, falhas/desempenho/diagnóstico (SDK do Google: **não**
   vinculados, publicidade de terceiros + análise, **sem rastreamento**).
7. Notas para o revisor (inglês, `appStoreReviewDetail`): onde ficam Loja, pacotes, VIP, login
   Apple; "no login needed, guest account".
8. **Envio** (pergunte antes): `POST /v1/reviewSubmissions` → `reviewSubmissionItems` com a versão →
   `PATCH … {submitted:true}`. Compras: `POST /v1/inAppPurchaseSubmissions` (cada uma). **A 1ª
   assinatura e o grupo dela só vão junto com uma versão** — use a tela da App Store Connect
   ("Adicionar para revisão" no VIP, no grupo "Passe VIP", nos produtos e na versão → "Enviar").

## FASE 7 — Google Play (quando o titular pedir)

Titular cria o app no Play Console. Você: keystore nova (fora do Git, `~/.imperio/keys/`),
`version/code` no preset Android, AAB pelo Godot, ficha da loja com as capturas android
(`docs/lojas/google`), formulários de conteúdo/privacidade (copiar respostas de
`docs/LOJAS_FORMULARIOS.md`). Compras/anúncios no Android ficam desligados até integrar Billing.

## FASE 8 — AdMob (anúncios só no iPhone)

Conta da empresa já existe (`authuser` da conta @crowntech.com.br). Com permissão do titular:
adicionar o app iOS (pela URL da App Store), criar bloco **Premiado** com verificação no servidor
(SSV) → `https://api-<sub>.crowntech.com.br/api/v1/ads/ssv` (no teste "Verificar URL", preencha
"dados personalizados" com um UUID qualquer), copiar App ID e bloco para `game/project.godot`
(`admob/general/ios/app_id` e `imperio/ads/ios_rewarded_unit`), publicar `app-ads.txt`
(`google.com, pub-…, DIRECT, f08c47fec0942fa0`) no **site do desenvolvedor da loja** (o
`marketingUrl` = `https://<sub>.crowntech.com.br/`) e também em `www.crowntech.com.br`. Só ligar
`ADS_PLATFORMS=ios` no Dokploy **depois** do e-mail de aprovação do Google (2–3 dias).

## FASE 9 — Fechamento

Atualize `docs/IMPLEMENTATION_STATUS.md`, `docs/BACKLOG.md`, `docs/DECISOES.md`, `README.md` e
mande ao titular um resumo curto (o que está no ar, o que falta dele).

---

## ARMADILHAS JÁ RESOLVIDAS NO MOTOR (não reintroduza)

- Recibo da App Store (JWS) tem ~6–7 KB: `purchaseToken` até 32 KB e corpo 64 KB em
  `/purchases/verify` e nas notificações da Apple (antes: toda compra real dava 400).
- Toques rápidos (evoluir/comprar com diamantes) são **juntados** num comando (`times`) e enviados
  antes de trocar de mapa/sair — não volte a mandar um pedido por toque.
- Auto-coleta vale em **todas** as cidades; o resumo ao abrir paga os ajudantes de todos os mapas.
- **Turbo = mais rápido** (+100% velocidade); **Dobro = cada coleta vale ×2** (valor, não velocidade).
- Ligas do ranking separadas por **vendas do império** (grupo fixo na semana); prêmios com bônus
  que gira por semana; coroa/prata/bronze; selo VIP.
- Linha do ranking só abre "denunciar" ao **soltar sem arrastar**.
- Selos/ícones de Turbo e Dobro ficam na **coluna direita** (como ícones), nunca por cima de janelas.
- Assinatura no **Sandbox** (iPhone de desenvolvimento) tem "mês" encurtado (1 dia nessa conta) —
  não é bug; a da App Store é 1 mês.
- A Apple exige **preço da assinatura em todos os 175 países** (inclusive UE, mesmo sem vender lá).
- Preços em BRL da Apple terminam em **,90** (não existe R$ 129,99).
- Plugin AdMob regrava `project.godot` se faltar alguma chave `admob/*` — todas ficam escritas.
- `grep` desta máquina é `ugrep` (opções diferentes): para trocas em massa use Python.
- Build de desenvolvimento usa bloco de anúncio de **teste** (ver o anúncio real no próprio aparelho
  é tráfego inválido).
- Pasta temporária do deploy (`/private/tmp/claude-501/deploy-wt`) pode sumir: recrie com
  `git worktree prune && git worktree add -B deploy/servidor <pasta> origin/deploy/servidor`.
- Push grande dá HTTP 408: `git -c http.version=HTTP/1.1 push`.

## COMANDOS DO DIA A DIA

```bash
# instalar no iPhone do titular (build de desenvolvimento)
. ~/.imperio/keys/appstore.env && rm -rf build/ios && mkdir -p build/ios
godot --headless --path game --export-debug "iOS" ../build/ios/imperio.ipa
cd build/ios && xcodebuild -project imperio.xcodeproj -scheme imperio -sdk iphoneos -configuration Debug \
  -destination 'id=00008110-00041D1A02D2401E' -derivedDataPath dd-device -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID" build
xcrun devicectl device install app --device 00008110-00041D1A02D2401E dd-device/Build/Products/Debug-iphoneos/*.app

# publicar o servidor (Dokploy faz o deploy sozinho)
git push origin main && git push origin main:deploy/servidor

# testes
cd backend && npm test && npm run typecheck && npm run format:check
godot --headless --path game res://tests/test_runner.tscn
IMPERIO_TEST_API=1 godot --headless --path game res://tests/test_runner.tscn   # com a API local no ar
```

**Comece agora pela FASE 0.** Ao terminar a Fase 1, mostre ao titular só o nome dos 8 mapas e os 4
primeiros negócios (uma linha cada) e já siga para a Fase 2 na mesma mensagem.
