# ADR 0022 — Loja paga no iPhone (StoreKit 2) e login com Apple

- **Status:** aceita · 2026-10-17
- **Contexto:** a 1.0.0 foi aprovada na App Store sem dinheiro real (ADR 0018). O titular pediu a
  loja paga **só na Apple** (itens e preços confirmados: 50/120/300 diamantes a R$ 4,90/9,90/19,90 e
  Passe VIP R$ 14,90/mês) e o botão "Vincular com a Apple" do Perfil funcionando.

## Decisões

- **Plugin:** Godot Apple Plugins (MIT, Miguel de Icaza; SwiftGodot) — só AuthenticationServices,
  StoreKit e o runtime. Binários (~180 MB) fora do Git: `tools/apple/fetch_plugins.sh` baixa a
  versão fixada e confere o SHA-256. iOS mínimo sobe para **17.0** (exigência do plugin).
- **Login com Apple:** `scripts/apple_auth.gd` pede só o identity token (sem nome/e-mail) →
  `POST /auth/link`. Conta Apple já ligada a outro progresso → oferece carregar aquele
  (`POST /auth/social`, reinicia o jogo). Capability "Sign in with Apple" no App ID e entitlement
  `com.apple.developer.applesignin`; `APPLE_AUDIENCES` padrão = bundle id.
- **Compras:** `scripts/apple_store.gd` (StoreKit 2): preço localizado da App Store, folha de
  compra da Apple, recibo `jwsRepresentation` → `POST /purchases/verify` (loja `apple`) e só então
  `finish()`; transação pendente volta no próximo início. Restaurar compras + aviso de renovação
  automática com termos/privacidade (diretriz 3.1.2).
- **Servidor:** `lib/apple-jws.ts` confere a cadeia x5c até a **Apple Root CA - G3** (impressão
  digital fixada), OIDs da Apple, validade e assinatura ES256; confere bundle id, produto, estorno e
  vencimento. Sandbox aceito (revisão da Apple compra em Sandbox). Estornos chegam por
  `POST /purchases/apple/notifications` (App Store Server Notifications V2) e revogam o item.
- **Por plataforma:** `PURCHASES_PLATFORMS=ios` liga a loja paga só para quem manda
  `platform=ios` no catálogo; a 1.0.0 não manda e continua sem loja paga; Android segue sem.
- Produtos criados na App Store Connect por `tools/apple/iap_setup.py` (148 países, imagem de revisão).
