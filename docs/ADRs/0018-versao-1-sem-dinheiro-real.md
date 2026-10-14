# ADR 0018 — Versão 1.0 nas lojas sem dinheiro real e sem anúncios

- **Status:** aceita · 2026-10-14
- **Fonte:** escolha do titular ("Lançar já, sem dinheiro real"); anúncios só recompensados
  depois (escolha do titular). Regras das lojas: itens digitais só via Google Play Billing /
  App Store; botões de compra simulados reprovam na revisão.

## Decisões

- Servidor: `PURCHASES_ENABLED` e `ADS_ENABLED` (padrão: ligados fora da produção, desligados em
  produção). Desligados, o catálogo omite diamantes em R$, Passe VIP e anúncio; as rotas de
  compra/anúncio respondem 409 (`PURCHASES_DISABLED`/`ADS_DISABLED`); a missão "assista
  anúncios" não é sorteada. Mock em produção só é recusado se o recurso estiver ligado.
- Jogo: esconde Passe VIP, diamantes em R$, "Restaurar compras", coleta grátis com anúncio e
  "Assistir anúncio e dobrar" conforme as chaves do catálogo.
- Diamantes continuam existindo como prêmio (missões, conquistas, calendário, pódio, evento) e
  compram Turbo, coleta antecipada e auto-coleta.

## Próximo (1.1)

- Anúncios recompensados (AdMob + SSV já pronto no servidor; UMP/consentimento; ATT no iOS).
- Compras reais: Google Play Billing e StoreKit 2, com verificação no servidor (conta de serviço
  da Play Developer API; chave da App Store Server API). Ligar as chaves no Dokploy.
