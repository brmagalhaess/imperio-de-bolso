# Checklist de publicação

Itens marcados por quem executou e confirmou. Nunca marcar aprovação de loja sem confirmação humana.

## Contas (ação do titular)
- [ ] Xcode → Settings → Accounts: conta Apple Developer conectada; anotar Team ID
- [ ] App Store Connect: contratos, dados fiscais e bancários em dia
- [ ] Google Play Console: cadastro, taxa US$25, verificação de identidade
- [ ] AdMob: conta criada, apps Android/iOS registrados (só IDs de teste no MVP)
- [ ] Domínio `imperiodebolso.com.br` (ou outro) confirmado; DNS para VPS

## Android
- [ ] Preset de exportação Android no Godot; package name confirmado
- [ ] Keystore de release criada e guardada fora do Git (com backup seguro)
- [ ] AAB assinado; Play App Signing configurado
- [ ] Teste em aparelho real; teste interno → fechado
- [ ] Ficha: ícone, screenshots reais, descrição, classificação etária, Data Safety,
      política de privacidade, declaração de anúncios, países

## iOS
- [ ] Preset iOS no Godot com Team ID e bundle ID
- [ ] Projeto Xcode exportado; signing/capabilities; teste em iPhone real
- [ ] Archive → App Store Connect → TestFlight interno/externo
- [ ] Ficha: screenshots reais, App Privacy, classificação, suporte, URL de exclusão de conta
- [ ] ATT/consentimento quando houver anúncios

## Servidor e web
- [ ] Stacks Dockploy staging e produção separadas (bancos, segredos, volumes)
- [ ] HTTPS, backups automáticos com restauração testada, healthcheck, monitoramento, rate limit
- [ ] Landing com política de privacidade, termos, exclusão de conta, suporte, app-ads.txt

## Monetização (ADR 0008)
- [ ] Produtos criados nas lojas com os IDs `br.com.imperiodebolso.gems_50/120/300` e `vip_monthly`
- [ ] Credencial da Google Play Developer API e chave da App Store Server API (fora do Git)
- [ ] Blocos de anúncio AdMob por plataforma; URL de SSV apontando para `/api/v1/ads/ssv`
- [ ] Trocar `STORE_MODE=live` e `ADS_MODE=admob` em produção (a API recusa mock lá)
- [ ] Notificações de reembolso configuradas (RTDN / App Store Server Notifications)

## Antes da submissão
- [ ] Revisar políticas vigentes da App Store e Google Play
- [ ] Monetização real só após conformidade e aprovação do titular
