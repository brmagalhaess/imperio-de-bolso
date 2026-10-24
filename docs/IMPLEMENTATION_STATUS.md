# Status de implementação

Também cumpre o papel de `docs/STATUS.md` citado no adendo do prompt mestre.

## 2026-10-24 — Prêmios com teto, virada da semana, evento após a venda e compartilhar (ADR 0029)

- Servidor: missões e calendário pagam no máximo o preço do próximo negócio; produção do domingo
  recebida na segunda fica na semana anterior; evento recomeça na venda do império; página de
  compartilhamento `/api/v1/share/rank/:id`. Testes: **168**.
- Jogo: botão "Compartilhar no Facebook" no ranking (3 abas); aviso "a pontuação zera toda
  segunda". Jogo: **153** verificações. Site: link do Google Play e imagem do post.
- Admin: conta de testes "Magalhães" marcada como equipe (saiu do ranking de Estrelas).

## 2026-10-24 — Android 1.0.3 enviado; compras e anúncios no Android prontos no código (ADR 0028)

- Apple: as 24 compras (diamantes, VIP, 20 pacotes, Dobro) estão **aprovadas**. AdMob: conta e
  apps ainda em análise (anúncios seguem desligados).
- Google Play: **1.0.3 (código 3)** enviada para revisão na produção (igual à da App Store, sem
  loja paga). App Android cadastrado no AdMob com bloco premiado e SSV verificado.
- Código: loja do Google (`google_store.gd`, plugin oficial 3.3.0) com a mesma interface da Apple;
  verificação no servidor pela Google Play Developer API (`lib/google-play.ts`); AdMob no Android.
  Build **1.0.4 (código 4)** gerado com os dois plugins (falta testar num aparelho/teste interno).
  Testes: servidor **164**, jogo **153** verificações.
- Pendente do titular: conta de comerciante no Play Console; conta de serviço do Google Cloud
  com acesso ao Play Console (para o servidor verificar compras).

## 2026-10-19 — Vender o império zera o ranking e renova as missões; conta da equipe (ADR 0027)

- Servidor: ranking da semana, liga e pódio contam só o faturamento depois da última venda do
  império na semana (marco `prestige_reset` do ledger). Ao vender, as missões de hoje não
  resgatadas são sorteadas de novo com alvo/prêmio do império novo (antes: prêmio de trilhões com
  100 moedas). Conta da equipe (`is_staff`, migração `20261019120000_staff_accounts`) fora de todos
  os rankings e pódios; `GET /leaderboard` traz `staff`. Testes: **160**.
- Painel admin: botão "Conta da equipe (tirar do ranking)" no detalhe do jogador; selo "equipe"
  na lista.
- Jogo: aviso "Conta da equipe" no ranking (pt/en/es). Jogo: **153** verificações.
- Conta do iPhone de desenvolvimento marcada como equipe no painel admin de produção (titular).

## 2026-10-18 — 1.0.2 aprovada; 1.0.3 (build 12) enviada

- Apple aprovou a **1.0.2** (à venda). Os 20 pacotes e o Dobro de moedas seguem "Aguardando
  revisão" (enviados à parte) — até aprovarem, a App Store não entrega esses produtos.
- **1.0.3** enviada com o build 12: ranking v2 (prêmios maiores + bônus semanal, ligas por
  vendas do império, coroa/medalhas, selo VIP), evoluções/compras rápidas sem perda, rolagem do
  ranking corrigida.

## 2026-10-18 — Ranking: rolar não abre mais "denunciar"; validade do VIP conferida

- Linha do ranking só abre denunciar/ocultar ao soltar o dedo sem arrastar (antes abria ao
  encostar e quem rolava caía nessa tela). Teste novo no `test_runner` (153 verificações).
- Validade do VIP conferida no banco de produção: compra real (App Store) 17/10 → 17/11; a do
  aparelho de desenvolvimento é do Sandbox da Apple, que renova a cada 1 dia nessa conta — o
  servidor grava a data que a Apple manda. Aviso da Loja (só no build de desenvolvimento) ajustado.

## 2026-10-18 — Ranking v2, ligas por vendas e selo VIP (ADR 0026)

- Servidor: grupos de liga por vendas do império (migração `20261018180000_league_brackets_prize_bonus`),
  prêmios 300/180/100 (semana) e 100/60/30 × liga, bônus semanal girando (Turbo, auto-coleta,
  coleta antecipada, diamantes em dobro) entregue no resgate, `vip` no ranking. Testes: **156**.
- Jogo: faixa de prêmios com coroa/prata/bronze, medalhas no pódio, selo VIP no ranking e no
  Perfil, textos da liga claros; aviso do "mês de 5 min" do Sandbox no build de desenvolvimento.
  Jogo: **151** verificações.

## 2026-10-18 — Evoluções rápidas se perdiam ao trocar de mapa/sair (corrigido)

- Causa: cada toque de evoluir virava um pedido numa fila; com muitos toques a fila levava
  segundos e, se o jogador trocava de mapa ou fechava o jogo antes, os últimos pedidos não
  chegavam — a tela mostrava níveis/gastos que o servidor nunca recebeu.
- Correção: toques seguidos no mesmo negócio se juntam (~0,35 s) num comando
  `POST /businesses/upgrade { times: N }` (servidor sobe até N níveis numa transação, parando no
  saldo); a fila é enviada antes de trocar de mapa (`enter_district` espera `settled()`), antes
  de qualquer outro comando e quando o jogo vai para o segundo plano.
- Loja (compras com diamantes): o mesmo — toques no mesmo item juntados em
  `POST /store/buy { times: N }` (compra até N, parando nos diamantes).
- Validado com o servidor local: 15 evoluções + troca de mapa → tela 31 = servidor 31; 5 Turbos
  tocados seguidos → diamantes 100→50 na tela e no servidor, Turbo de 5 h.
  Testes: backend **154**; jogo **151** unitários e **191** com integração.

## 2026-10-18 — Dobro corrigido (valor ×2) e site v2

- Dobro de moedas: cada coleta paga ×2 (manual, auto-coleta, AFK na janela); a velocidade não
  muda — Turbo acelera, Dobro dobra. Correção só no servidor (vale para o build 11). Testes: 150.
- Apple: 25 produtos cadastrados — diamantes (3) e VIP aprovados; 20 pacotes + Dobro aguardando a
  revisão da 1.0.2.
- Site (`landing/`) v2: herói com o mar do jogo, aparelho com tela real, galeria de telas,
  recursos com ícones do jogo, FAQ atualizado e botão "Baixar grátis na App Store"
  (`apps.apple.com/br/app/id6822892071`). Google Play segue "Em breve".

## 2026-10-18 — Dobro de moedas e auto-coleta em todas as cidades (ADR 0025)

- **Bug corrigido (servidor):** auto-coleta só liquidava o mapa aberto (as outras cidades paravam
  no teto de 4h) e o resumo ao abrir o jogo só pagava o mapa de entrada. Agora: com auto-coleta,
  todas as cidades a cada sinal; ao abrir o jogo, os ajudantes de todos os mapas.
- **Dobro de moedas** (R$ 129,90, 3/mês, ×2 na velocidade total): migração
  `20261018120000_double_coins`, item na Loja, produto `double_1h` na App Store Connect ("Pronto
  para envio").
- Jogo: Turbo/Dobro como ícones na coluna direita (arte nova, US$ 0,18); selos de texto e a
  sobreposição deles com janelas abertas removidos.
- Testes: backend **148**, jogo **151**.

## 2026-10-18 — Pacotes promocionais (ADR 0024) e VIP ativo na Loja

- **1.0.2 enviada à Apple** (build 10) com os 20 pacotes: tudo "Aguardando revisão". Ajuste do
  selo do Turbo (folga abaixo da renda/s; a coluna dos pacotes desce enquanto ele aparece).

- Servidor: `economy/bundles.ts` (20 pacotes), `services/bundles.ts` (vitrine ≤ 5, limite por
  semana, entrega), catálogo com `offers`, `/purchases/verify` com `district`. Testes: **144**.
- App Store Connect: 20 consumíveis criados (`tools/apple/bundles_setup.py`), preço base BRA,
  3 idiomas e imagem de revisão — todos "Pronto para envio".
- Jogo: coluna direita com até 5 ícones (pulso + tempo restante) e tela do pacote; Passe VIP
  ativo mostra "Ativo ✓" e "Gerenciar assinatura". Arte: 20 ícones (US$ 0,54). Capturas:
  `docs/lojas/capturas/compras/ofertas_*.jpg`. Jogo: **151** verificações.
- Também: marcadores de conflito de merge antigos removidos de `tools/art/generations.jsonl` e
  `tools/art/jobs/v6-expansao-teste.json` (quebravam o gerador de arte).

## 2026-10-18 — Compra real na Apple falhava (corrigido no servidor)

- Todo `POST /purchases/verify` da App Store voltava **400**: o `purchaseToken` era limitado a
  4096 caracteres e o JWS real (cadeia x5c com 3 certificados) tem ~6–7 KB. Nos testes passava
  porque a cadeia de teste é menor. Agora: token até 32 KB e corpo de 64 KB em
  `/purchases/verify` e nas notificações da App Store; teste com recibo do tamanho real.
- As transações que falharam ficaram **sem finalizar** na Apple (o jogo só finaliza depois do
  servidor aceitar): voltam pelo `Transaction.updates` ao abrir o app e são creditadas.
- Site da empresa no ar no nosso servidor (DNS trocado no Cloudflare; Let's Encrypt ok) com
  `app-ads.txt` em `www.crowntech.com.br`; aguardando o rastreador do AdMob.

## 2026-10-18 — Situação das lojas

- **Apple:** 1.0.1 **à venda** (READY_FOR_SALE); 3 pacotes de diamantes e Passe VIP **aprovados**.
- **Google Play:** produção 2 (1.0.0) ainda **em revisão** (desde 15/10, primeira publicação).
- **AdMob:** perfil de pagamentos completo; conta aguardando aprovação; app com "veiculação
  limitada" — a verificação do `app-ads.txt` falha porque o Google procura no domínio raiz
  `crowntech.com.br` (outro servidor, 2.24.94.160), não em `imperio.crowntech.com.br`.
- Site da empresa (repo `brmagalhaess/crowntech-site`) migrado para o nosso Dokploy: projeto
  Crowntech → "Site CrownTech" (`docker-compose.vps-imperio.yml`, domínios www e raiz no Traefik
  com Let's Encrypt) já com `app-ads.txt`. DNS apontado (Cloudflare) e HTTPS ok. Falta desligar o site
  na VPS antiga (2.24.94.160).

## 2026-10-17 — 1.0.1 ENVIADA para revisão da Apple (build 8 + 4 compras)

- Acordo de apps pagos **Ativo** (banco e formulários fiscais aprovados).
- Envio com 6 itens: versão 1.0.1 (build 8, com o SDK do AdMob), Passe VIP mensal, grupo
  "Passe VIP" e os 3 pacotes de diamantes. Notas para o revisor atualizadas (loja, login Apple).
- VIP travava com "falta preço": a Apple exige preço em todos os 175 países, inclusive os 27 da
  UE onde o app não é vendido — criados pelas equivalências; `iap_setup.py` corrigido.
- Privacidade do app publicada: + localização aproximada, ID do dispositivo, dados de
  publicidade e diagnóstico (SDK do Google, sem vínculo e sem rastreamento) e histórico de
  compras (vinculado, funcionalidade).
- **Anúncios ficam desligados no servidor** (`ADS_PLATFORMS` vazio) até o AdMob aprovar o app
  (perfil de pagamento da empresa + `app-ads.txt`); depois é só ligar `ADS_PLATFORMS=ios` no
  Dokploy, sem build novo.

## 2026-10-17 — Anúncios recompensados reais só no iPhone (ADR 0023) — preparado

- Servidor: `ADS_PLATFORMS=ios` (catálogo `adsEnabled` por plataforma + `adsMode`; `/ads/start`
  com `platform`; produção recusa com `ADS_MODE=mock`). Teste novo `ads-platforms.test.ts`.
- Jogo: plugin AdMob v5.1.0 (Poing Studios, `tools/apple/fetch_admob.sh`, fora do Git) só no iOS;
  `scripts/admob_ads.gd` (consentimento UMP → SDK → anúncio com `sessionId` no SSV → resgate
  repetido até o servidor confirmar). Sem o plugin o jogo segue com o anúncio de teste.
- Build do iPhone compila com o Google Mobile Ads SDK 13.9 (SPM) e abre normalmente no aparelho
  (App ID de **teste** do Google). Anúncio real ainda não exibido: falta a conta.
- Testes: backend **139**; jogo **151** (com e sem o plugin instalado).
- **Incidente (~7 min fora do ar, 17:22–17:29 UTC):** o Dokploy estava com `ADS_MODE=live`
  (valor inválido; os aceitos são `mock`/`admob`) e a API não subiu no deploy deste commit.
  Corrigido para `ADS_MODE=admob` (anúncios seguem desligados com `ADS_PLATFORMS` vazio).
  Lição: conferir as variáveis do Dokploy contra o `prod.env.example` antes de cada deploy.
- **Pendente:** titular criar a conta AdMob da empresa → app iOS + bloco Premiado com SSV →
  IDs no `project.godot`, `app-ads.txt`, privacidade na App Store, `ADS_MODE=admob` +
  `ADS_PLATFORMS=ios` no Dokploy (lista em ADR 0023).

## 2026-10-17 — 1.0.0 aprovada na App Store; 1.0.1 com login Apple e loja paga no iPhone (ADR 0022)

- Login com Apple no Perfil (plugin Godot Apple Plugins; capability no App ID; iOS mínimo 17).
- Loja paga só no iPhone: StoreKit 2 no jogo; servidor verifica o JWS da Apple (Apple Root CA G3),
  estorno por App Store Server Notifications V2; `PURCHASES_PLATFORMS=ios` em produção (a 1.0.0
  não manda a plataforma e segue sem loja paga). Produtos criados na App Store Connect (3
  diamantes "Pronto para envio"; VIP em processamento).
- Capturas novas: iPhone 6,3" (exigida — faltava, por isso a busca não mostrava imagens) e iPhone
  Duo (externa 1398×2034, interna 2007×2853); `tools/apple/capture.sh`.
- Testes: backend **137** (inclui `apple-purchases.test.ts` com cadeia própria); jogo **151**.
- Perfil: conta já vinculada mostra "Progresso salvo na sua conta Apple ✓" no lugar do botão.
- App Store Server Notifications V2 configuradas (produção e sandbox) para a rota de estorno.
- Produção passou para `STORE_MODE=live`/`BETA_SANDBOX=false` no Dokploy (antes a loja mostrava
  "compra de teste"). Vínculo Apple confirmado no servidor (POST /auth/link 200 do iPhone).
- Negócios Apple: formulário do Brasil e W-8BEN-E ativos; banco em processamento; falta o
  Certificate of Foreign Status; acordo de apps pagos "informações pendentes".
- Versão **1.0.1** criada na App Store Connect com o **build 7** (5 e 6 trocados; o 7 corrige a leitura do token do login Apple) (perfil de distribuição recriado
  com o Sign in with Apple), novidades e o bloco de compras/assinatura com links de Termos e
  Privacidade nos 3 idiomas, e capturas 6,9", 6,3", iPhone Duo (tela aberta) e iPad aceitas.
  VIP pronto para "Adicionar para revisão" (a 1ª assinatura vai junto com uma versão nova).
  **Ainda não enviada para revisão.**
- **Pendente:** Certificate of Foreign Status (titular) e aprovação do banco pela Apple (até 24 h);
  com o acordo de apps pagos Ativo, enviar a 1.0.1 + os 4 produtos para revisão.

## 2026-10-15 — Painel admin v2 (ADR 0021)

- Abas novas: Economia (67 negócios, 5 faixas visuais, fluxo de moedas/diamantes por tipo),
  Ranking (top 20, ligas, pódio) e Moderação (trocar nome denunciado / arquivar). Visão geral com
  D7, funil por mapa, reforços ativos, prêmio diário/missões/baú de hoje, evento e denúncias.
  Detalhe do jogador completo; ledger com motivos em português.
- Testes: `backend/test/admin.test.ts` (4) + suíte completa.

## 2026-10-15 — Mapas maiores, 5 evoluções e denúncia no ranking (ADR 0020)

- **Evoluções:** 5 visuais por negócio (níveis 1, 10, 25, 50, 100); 92 artes novas dos 46
  negócios (Higgsfield, US$ 6,44). Sem a arte de uma faixa o jogo usa a anterior.
- **Mapas maiores (servidor pronto, NÃO publicado):** 3 negócios novos por mapa da cidade em
  diante (67 no total), receita por nível 1,10 (era 1,12) — império completo em ~17 dias
  (engajado) a ~30 (casual) na simulação. Artes: 21 nível 1, 47 de 84 evoluções, 21 ajudantes.
- Ilhas de expansão com os 3 lotes novos em cada mapa (arrastar/pinça). Arte completa: 105
  visuais dos negócios novos + 21 ajudantes + 7 ilhas.
- Apple pediu informações (diretriz 2.1, conta nova): respondido com o vídeo gravado no iPhone
  (comprimido para 5 MB com ffmpeg) e as 6 respostas (`docs/lojas/apple/resposta-revisao-2.1.md`);
  **reenviado em 2026-10-15 com o build 4** — aguardando revisão.
- Google Play: lançamento 2 (AAB code 2, mesmo conteúdo) substituiu o 1 em análise (revisão
  reiniciada).
- Testes: backend **130**; jogo **151** unitários e **191** com integração.
- Gasto total registrado em arte: ~US$ 26,3 (teto aprovado nesta etapa: +US$ 21).

## 2026-10-15 — Simulação de jogadores e balanceamento

- `backend/scripts/simulate-player.ts`: perfis novato/curioso/casual/engajado com as fórmulas reais.
- Praia mais barata (pipoca 250, sorveteria 1.000, quiosque 4.000; ajudantes 1.000/4.000/16.000):
  2º negócio aos ~1 min (antes ~6 min), praia completa aos ~21 min.
- Estrelas do prestígio logarítmicas (ADR 0011 revisada): fim do bônus explosivo.
- Loja: coleta antecipada mostrava 0 (catálogo velho / mapa sem negócio) — agora calculada do
  estado no app; sem negócio no mapa o botão trava com aviso.
- Vender o império agora exige o império completo (todos os negócios + todos os ajudantes), com
  progresso no Perfil (ADR 0011 revisada).
- Testes: backend **129** OK; jogo **145** unitários e **185** com integração OK. (Docker
  reiniciado com autorização: o disco externo tinha ficado somente-leitura.)

## 2026-10-14 — Google Play: versão 1.0.0 enviada para revisão

- App "Império de Bolso" (pacote `br.com.imperiodebolso.game`, ID 4973883264134295100) na conta
  de organização Crown Tech LTDA; site e telefone validados.
- Conteúdo da app concluído: privacidade, acesso, anúncios (não), classificação IARC (Geral),
  público 13+, ID de publicidade (não), segurança dos dados (IDs, interações e nome de exibição;
  nada partilhado; exclusão em `/excluir-conta/`), funcionalidades financeiras/saúde (nenhuma).
- Definições: Jogo › Simulação; contato `suporte-imperio@crowntech.com.br`.
- Ficha pt-BR: descrições, ícone 512, destaque 1024×500, 8 capturas de celular e de tablet
  7"/10" (`docs/lojas/`); arte declarada como gerada por IA.
- **Produção 1.0.0 enviada para revisão** (AAB versão 1, 150 países + "resto do mundo", sem a
  UE; publicação gerida desativada → publica sozinho ao ser aprovado; revisão em até ~7 dias).

## 2026-10-14 — Apple: versão 1.0.0 enviada para revisão (ADR 0019)

- App "Império de Bolso" na App Store Connect (Crown Tech LTDA, ID 6822892071), build 1 VALID,
  TestFlight interno "Equipe Crown Tech".
- Metadados pt-BR/en/es, capturas iPhone 6.9" e iPad 13", 13+, privacidade publicada, 148
  territórios (sem a UE). Enviada para revisão com lançamento automático após aprovação.

## 2026-10-14 — Pódio semanal (ADR 0017)

- Prêmios de 1º/2º/3º no ranking da semana (100/60/30 💎) e na liga (30/20/10 × nível), exibidos
  no Ranking e entregues com aviso "Parabéns!" ao entrar. Confirmado em teste: vender o império
  não tira o jogador do ranking.
- Versão 1.0 sem dinheiro real e sem anúncios (ADR 0018), chaves no servidor.
- Testes: backend **129**; jogo **143** verificações. (O Docker local tinha travado porque o disco
  externo onde ele guarda os dados foi remontado; reiniciado com autorização do titular.)

## 2026-10-14 — Lote 2: velocidade, retenção, mapas 5–8, iPad e contas vinculadas

- **Aceleradores (ADR 0013):** ajudante +25%, marcos de nível 10/25/50/75/100 +50% cada, VIP +50%,
  Turbo 2× na Loja (1 h/4 h/24 h); tudo soma; AFK conta cada trecho na velocidade que tinha.
- **Retenção (ADR 0014):** calendário de 7 dias (abre sozinho), baú das 3 missões, ligas semanais
  Bronze→Diamante, ranking de estrelas, evento de fim de semana (lucro 2× + meta com diamantes).
- **Mapas 5–8 (ADR 0016):** Polo Industrial, Serra Nevada, Ilha Paraíso, Centro Espacial — 24
  negócios novos com arte Higgsfield (~US$ 6,7 dos US$ 8 aprovados); fórmulas em inteiros exatos.
- **iPad** habilitado (iPhone + iPad, retrato). **Contas vinculadas (ADR 0015):** servidor e tela
  "Salvar progresso" prontos; login nativo depende das contas das lojas.
- Testes: backend **125**; jogo **139** unitários e **179** com integração. Telas novas (Loja/Turbo,
  Diário, Missões/baú, Ranking/liga, Evento) e os 4 mapas construídos conferidos em captura.

## 2026-10-14 — Correções pedidas pelo titular (lote 1 de 2)

- **Auto-coleta ao vivo:** sem moeda parada esperando; cada ciclo dos ajudantes do mapa aberto
  aparece na hora (+lucro uma vez só) e o saldo anda; o servidor paga os ciclos completos antes
  de comprar/melhorar/contratar (`settleLive`) — fim da "duplicação".
- **Melhorias não voltam mais:** resposta de presença/atualização pedida antes de um toque é
  descartada; a fila de confirmações só termina depois de acertar o estado.
- **Números abreviados** (9.999 · 12,3K · 1,23M · 45,6B · 7,89T · 1,5aa) no saldo e em toda a tela;
  painel do negócio não sai mais da tela (texto corta com "…").
- **Loja, Missões e Conquistas na hora:** resgates, diamantes diários do VIP e compras com
  diamantes respondem no toque; servidor confirma em seguida.
- **Prédios no lugar** no Porto e no Centro (base na borda de baixo de cada quadra).
- **Missões por fase:** sem missão de iniciante para quem evoluiu, sem missão impossível, alvos
  maiores, novas "Fature (1 h de renda)" e "Assista 2 anúncios"; tela troca sozinha quando vira o dia.
- Testes: backend **110**; jogo **131** unitários e **171** com integração.

## 2026-10-14 — Etapa 6 · V1.2a: Idiomas inglês e espanhol (ADR 0012)

- 258 textos traduzidos (interface, erros, tutorial, mapas, negócios, missões, conquistas, Loja)
  em `game/i18n/translations.csv`; extrator `tools/i18n/extract.py`.
- Configurações → Idioma (Automático/Português/English/Español), salvo no aparelho; números no
  padrão de cada idioma. Servidor: missões com `titleTemplate` (contrato atualizado).
- Testes: backend **107**; jogo **116** unitários e **156** com integração. Capturas em en/es
  conferidas (Missões, Loja, Idioma).
- Nome do jogo mantido em português (OPEN_QUESTIONS 12).

## 2026-10-14 — Etapa 6 · V1.1: Prestígio "Vender o império" (ADR 0011)

Revisados antes: docs/README.md §4/§69, PROMPT_MESTRE (Etapa 6), BACKLOG, conversa original.
- Servidor: estrelas de investidor (+2% de lucro cada) aplicadas em toda produção; venda zera
  negócios/moedas/mapas e mantém diamantes, conquistas, VIP e ranking; conquista "Investidor";
  migração `*_prestige`. Backend **107 testes**.
- Jogo: seção Prestígio no Perfil (acima das conquistas) e confirmação; volta à praia após vender.
  Jogo 141 verificações com integração.
- Também nesta rodada: resposta imediata em coletar/comprar/melhorar/contratar (fila de
  confirmação), rolagem por toque nas listas, iPhone testado com conta gratuita (ID `.dev`).
- Pendências fora do código: contas Google Play (validação do site) e Apple (pagamento em
  processamento); `ADMIN_TOKEN` do staging diferente do arquivo local.

## 2026-10-13 — Mapas 3 e 4, trilha de mapas, toque e iOS (ADR 0010)

- **Novos mapas** Porto da Marina e Centro Financeiro (6 negócios cada; 22 no total), arte
  Higgsfield (US$ 3,18 de US$ 4 aprovados), conquistas por mapa; **tela de Mapas em trilha**
  com nuvens nos bloqueados e "Em breve" no topo.
- **Toque no celular:** tolerância de 40 px no toque da ilha, folga de rolagem nas listas, sem
  toque duplicado, fundo da janela fecha ao soltar, agile_event_flushing.
- **Código do jogador** em destaque no Perfil com botão Copiar.
- **iOS:** preset e ícone 1024; projeto Xcode gerado e compilado. O template oficial do Godot
  não traz simulador para Apple Silicon (só x86_64, recusado pelos simuladores iOS 26/27) →
  testar em iPhone real (precisa do aparelho conectado e do Modo Desenvolvedor) ou compilar o
  template do Godot. Xcode ainda só com o Personal Team.
- Testes: backend 103; jogo 87 unitários, 125 com integração.

## 2026-10-13 — Landing e políticas das lojas; código do jogador

- `landing/` (Next.js 16.3.8, export estático + nginx): home com tela real do jogo, Política de
  Privacidade (LGPD + Marco Civil), Termos de Uso, Excluir conta (no app e por e-mail com o
  Código do jogador) e Suporte; robots/sitemap. Dados da empresa por build args — o build de
  produção falha se faltar razão social, CNPJ, cidade ou e-mail. Publicado em
  https://imperio.crowntech.com.br com os dados da CROWN TECH LTDA (CNPJ 65.586.793/0001-18,
  Maricá/RJ, suporte-imperio@crowntech.com.br). Respostas dos formulários das lojas: `docs/LOJAS_FORMULARIOS.md`.
- Jogo: "Código do jogador" no Perfil; admin encontra a conta pelo código. Cartão do tutorial
  sobe quando a seta aponta para a barra (não cobre o texto).
- Decisão do titular: conta de convidado + vincular Google/Apple no Perfil (próximo passo).
- Xcode está só com o Personal Team: falta adicionar a equipe da empresa.

## 2026-10-13 — Sons, efeitos e música (pedido do titular)

- Higgsfield não gera música/efeitos (o conector recusa; a API só tem modelos de imagem/vídeo).
  Com autorização do titular: pacotes **CC0** (Kenney: interface, cassino, jingles; OpenGameArt:
  "Tropical Fantasy" na Praia e "Sandy Seaside 2" na Cidade). Créditos em
  `game/assets/audio/CREDITOS.md`. Jingles escolhidos por análise da melodia (sobe = positivo).
- Autoload `Audio`: clique em todo botão, moedas ao coletar, jingles de compra/melhoria/ajudante/
  prêmio, som de erro (não para falta de rede), música por mapa com transição e volume menor com
  janela aberta. **Configurações** (engrenagem): Música e Efeitos liga/desliga, salvo no aparelho.
- Testes: jogo 78 unitários, 116 com integração.

## 2026-10-13 — Etapa 5 (em andamento): beta Android, segurança e backups

Revisados antes: docs/README.md (Etapa 5), PROMPT_MESTRE (Etapa 5), plano §24/§28, conversa.
- **API:** limite de requisições por IP (geral 600/min; `/auth/guest` 20/min), helmet, corpo
  máximo 16 KB, logs sem query/corpo, `TRUST_PROXY`. `BETA_SANDBOX=true` libera loja/anúncios
  de teste em produção só para o teste fechado. Backend: **97 testes**.
- **Backups:** `pg_dump` diário criptografado (AES-256) com rotação; restauração testada
  (contagens e saldo idênticos; senha errada falha sem tocar no banco).
- **Deploy:** `infrastructure/docker-compose.prod.yml` + guia Dockploy no
  `infrastructure/README.md` (aguarda acesso do titular à VPS e domínio).
- **Android:** APK de depuração (arm64 + x86_64) e **AAB de release assinado** via Gradle
  (preset "Android Release"). Keystore de upload em `~/.imperio/keys/` (fora do Git, chmod 600)
  — o titular precisa guardar cópia segura. `tools/android/run_device.sh` instala e abre no
  aparelho com `adb reverse` para a API local.
- **Defeito corrigido:** o APK saía com `allowBackup=false` — reinstalar o app ou trocar de
  celular perdia o progresso. Agora o Backup automático do Android guarda a conta convidada.
- **Exclusão de conta (LGPD/Play):** Perfil → "Excluir conta" → digitar EXCLUIR. Servidor apaga
  tudo; recibos ficam sem dono (anti-reuso/reembolso); VIP pode ser religado. Migração
  `*_account_deletion`. Backend **102 testes**; jogo 62 unitários, 100 com integração.
- **Teste no aparelho (Redmi Note 9 Pro, Android 12, Adreno 618):** jogo abre, conecta à API
  local via `adb reverse`, ~240 MB de RAM, 35–50% de um núcleo parado, sem aquecimento.
  Corrigido no aparelho: seta do tutorial agora segue o passo (some após a compra; aponta a
  moeda pronta, "Melhorar" só com saldo, e o botão Ajudantes no fim); ícone do app próprio
  (carrinho de água, `tools/art/make_app_icon.py`, adaptativo + monocromático, sem custo de
  geração) e abertura com a arte do jogo no lugar do logo do Godot. Falhas de conexão no
  aparelho vêm do cabo/`adb reverse` — resolvidas com a API na VPS (HTTPS).
- **Staging online (Dokploy do titular):** `https://api-imperio.crowntech.com.br` e
  `https://admin-imperio.crowntech.com.br` via nginx-proxy + Let's Encrypt do servidor;
  autodeploy da branch `deploy/servidor`. O APK usa `imperio/api/base_url_mobile` (o sufixo
  `.android` não era aplicado no jogo exportado — corrigido). Testado no Redmi pela internet:
  conta criada e compra gravada no servidor. Ícone do jogo na tela inicial do aparelho.
- **Pendente:** Play Console (teste interno → fechado);
  stack staging na VPS; link web de exclusão (landing).

## 2026-10-13 — Ajustes da Loja e Perfil (pedidos do titular)

- **Coleta antecipada** (15 min grátis com anúncio, 1 h e 4 h com diamantes) com estimativa de
  moedas do mapa atual e contador **"Hoje: x/5"**; trava no limite.
- **Passe VIP:** +5 diamantes por dia (resgate na Loja, um por dia).
- **Perfil:** trocar o nome **uma única vez**, com validação, palavras bloqueadas e nome único.
- Correções: janela nova abre no topo (Perfil herdava a rolagem da Loja); executor de testes com
  limite de tempo local e `timeout-minutes` no CI (erro de script travava o Godot).
- Incidente local: uma migração falhou no meio (a coluna não entrou no schema por causa do
  alinhamento do `prisma format`); revertida com `migrate resolve` e reaplicada só no banco de
  desenvolvimento. Lição: conferir o SQL gerado antes do `deploy`.
- Testes: backend 93; jogo 60 unitários + 95 integração.

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
