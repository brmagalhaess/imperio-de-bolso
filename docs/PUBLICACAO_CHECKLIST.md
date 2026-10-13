# Checklist de publicação

Itens marcados por quem executou e confirmou. Nunca marcar aprovação de loja sem confirmação humana.

## Contas (ação do titular)
- [ ] Xcode → Settings → Accounts: conta Apple Developer conectada; anotar Team ID
- [ ] App Store Connect: contratos, dados fiscais e bancários em dia
- [ ] Google Play Console: cadastro, taxa US$25, verificação de identidade
- [ ] AdMob: conta criada, apps Android/iOS registrados (só IDs de teste no MVP)
- [ ] Domínio `imperiodebolso.com.br` (ou outro) confirmado; DNS para VPS

## Android
- [x] Preset de exportação Android no Godot (debug APK + release AAB); package `br.com.imperiodebolso.game` (confirmar antes do 1º upload: não muda depois)
- [x] Keystore de upload criada fora do Git (`~/.imperio/keys/`, chmod 600)
- [ ] Backup seguro da keystore e de `release.env` feito pelo titular (gerenciador de senhas/cofre)
- [x] AAB assinado com a chave de upload
- [ ] Play App Signing configurado no Console (ação do titular)
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
- [ ] Stacks Dockploy staging e produção separadas (compose pronto: `infrastructure/docker-compose.prod.yml`)
- [x] Backups automáticos criptografados com restauração testada (local), healthcheck, rate limit
- [ ] HTTPS no Traefik do Dockploy e monitoramento (na VPS)
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
