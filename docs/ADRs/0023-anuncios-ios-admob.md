# ADR 0023 — Anúncios recompensados reais (AdMob) só no iPhone

- **Status:** aceita · 2026-10-17
- **Contexto:** a 1.0 saiu sem anúncios (ADR 0018). Com a loja paga indo para o iPhone (ADR 0022),
  o titular pediu os anúncios recompensados **só na Apple** — o app do Google Play ainda não está
  ativo. O servidor já tinha sessão de anúncio, SSV do AdMob verificado e limites (ADR 0008).

## Decisões

- **Conta:** AdMob da empresa (Crown Tech LTDA, BRL), criada pelo titular com a conta
  @crowntech.com.br — não a AdSense pessoal do Gmail.
- **Plugin:** poingstudios/godot-admob-plugin **v5.1.0** (MIT), pacote iOS para Godot 4.7.2; o
  Google Mobile Ads SDK 13.9 entra por Swift Package Manager na exportação. Fora do Git:
  `tools/apple/fetch_admob.sh` baixa a versão fixada e confere o SHA-256. Só o SDK principal (sem
  redes de mediação). Android desligado (`admob/general/android/enabled=false` + marcador de
  versão para o plugin não baixar binários no modo headless).
- **project.godot:** todas as chaves `admob/*` ficam escritas no arquivo — se faltar alguma, o
  plugin chama `ProjectSettings.save()` e regrava o arquivo perdendo configurações (aconteceu no
  primeiro teste: traduções e splash sumiram).
- **Jogo:** `scripts/admob_ads.gd` carrega os scripts do plugin por caminho (sem o plugin =
  `available()` falso, testes e Android seguem com o anúncio de teste). Fluxo: UMP (consentimento)
  → SDK → anúncio pré-carregado → `/ads/start` → anúncio com `custom_data = sessionId` →
  servidor recebe o SSV do Google → `/ads/claim` (repete enquanto `AD_NOT_VERIFIED`).
- **Servidor:** `ADS_PLATFORMS=ios` liga anúncios só no iPhone (catálogo por `platform`,
  `/ads/start` com `platform`). Missões de "assistir anúncio" continuam só com `ADS_ENABLED`
  global (a missão diária não sabe a plataforma). Produção recusa `ADS_PLATFORMS` com
  `ADS_MODE=mock`. O catálogo informa `adsMode`.
- **Sem rastreamento (ATT):** não pedimos a permissão de rastreamento da Apple; os anúncios
  seguem sem IDFA. Não ativar a mensagem de IDFA no "Privacidade e mensagens" do AdMob sem
  adicionar `NSUserTrackingUsageDescription` e revisar a privacidade da App Store.

## Contas e IDs (2026-10-17)

- AdMob da empresa: `pub-9538653038510274` (login brunomagalhaes@crowntech.com.br).
- App iOS: `ca-app-pub-9538653038510274~3260733869` · bloco Premiado
  `ca-app-pub-9538653038510274/3843187791` com SSV para `/api/v1/ads/ssv` (URL verificada pelo
  Google). `app-ads.txt` publicado em `imperio.crowntech.com.br/app-ads.txt`.
- Build de desenvolvimento usa sempre o bloco de **teste** do Google (ver o anúncio real no
  aparelho do desenvolvedor é tráfego inválido); só o release usa o bloco real.
- Callback assinado sem sessão (o teste "Verificar URL") responde `200 { verified: false }`.

## Para ligar em produção (pendente)

1. ~~Conta AdMob, app iOS, bloco Premiado com SSV, IDs no `project.godot`, `app-ads.txt`~~ (feito).
2. Titular: completar o perfil de pagamentos no AdMob (empresa, BRL); aguardar o Google verificar o
   app pelo `app-ads.txt` (até 24 h).
4. App Store Connect → Privacidade do app: declarar os dados coletados pelo SDK do Google
   (identificadores do dispositivo, dados de uso/publicidade, diagnóstico), sem rastreamento.
5. Dokploy: `ADS_MODE=admob` (já) e `ADS_PLATFORMS=ios`; novo build do iPhone com o SDK.

## Consequências

- O mesmo build funciona com o servidor em `mock` (anúncio de teste do Google + confirmação de
  teste) e em `admob` (SSV real).
- Os IDs de teste do Google ficam até a conta existir; nada é cobrado nem pago com eles.
