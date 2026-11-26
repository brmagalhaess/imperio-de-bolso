# ADR 0019 — Publicação na Apple (App Store Connect / TestFlight)

- **Status:** aceita · 2026-10-14
- **Fonte:** pedido do titular ("publicar na Apple"; escolheu "Chave de API da App Store Connect").

## Decisões

- **Conta:** Crown Tech LTDA, time `HZYY469476`. App "Império de Bolso" (Apple ID `6822892071`),
  bundle `br.com.imperiodebolso.game`, SKU `imperio-de-bolso`, idioma principal pt-BR, iPhone + iPad.
- **Chave da API** "Imperio Build" (papel Gerente de apps) em `~/.imperio/keys/appstore.env` +
  `AuthKey_*.p8` — fora do Git. `tools/apple/asc.sh` chama a API (token ES256 gerado localmente).
- **Assinatura de distribuição manual** (a "assinatura na nuvem" exigiria chave de Administrador):
  certificado "Apple Distribution: Crown Tech LTDA" criado pela API com chave privada gerada no
  Mac (`~/.imperio/keys/apple_dist.key`, importada no Keychain) e perfil "Imperio de Bolso App
  Store". Vencem em 10/2027.
- **Envio:** `sh tools/apple/release.sh <build>` exporta o Godot, arquiva, assina e envia; o número
  do build cresce a cada envio. iPhone do titular cadastrado no time (exigência para o perfil de
  desenvolvimento do arquivamento).
