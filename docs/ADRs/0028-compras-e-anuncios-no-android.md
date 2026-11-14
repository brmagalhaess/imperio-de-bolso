# ADR 0028 — Compras (Google Play Billing) e anúncios (AdMob) no Android

- **Status:** aceita · 2026-10-24
- **Contexto:** o Android estava na 1.0.0 sem loja paga nem anúncios. O titular pediu o Android
  igual ao iPhone: mesma versão, itens pagos e anúncios.

## Decisões

- **Compras:** plugin oficial `GodotGooglePlayBilling` 3.3.0 (Billing Library 9.1), instalado por
  `tools/android/fetch_billing.sh` (SHA-256 fixado; ~40 KB, MIT, versionado no Git). O jogo usa o singleton direto em
  `scripts/google_store.gd`, com a mesma interface da loja da Apple (`load_products`, `price`,
  `buy`, `restore`, `manage`); `GameState.store_node` escolhe a loja do aparelho.
- **Mesmos IDs de produto da Apple** (`br.com.imperiodebolso.*`) e o Passe VIP como assinatura com
  um plano base mensal (o jogo compra o plano base sem desconto).
- **Servidor é a autoridade:** `/purchases/verify` com `store: "google"` consulta a Google Play
  Developer API (`purchases.products` / `purchases.subscriptionsv2`) com a conta de serviço
  `GOOGLE_PLAY_SERVICE_ACCOUNT` (JSON ou base64). Transação = número do pedido (cada renovação
  gera outro). Pendente/cancelada/vencida não entregam. O jogo só consome (consumíveis) ou
  reconhece (assinatura) depois que o servidor aceitou; o que ficar sem entregar volta pelo
  `queryPurchases` ao abrir o jogo. Testadores licenciados (sem cobrança) são aceitos.
- **Anúncios:** o mesmo plugin AdMob (Poing 5.1.0) com o template Android; app
  `ca-app-pub-9538653038510274~1940408178`, bloco premiado `…/8046651528` com SSV na mesma URL.
  O build de desenvolvimento usa o bloco de teste do Google.
- **Liga e desliga no servidor:** `PURCHASES_PLATFORMS=ios,android` e `ADS_PLATFORMS=ios,android`
  (Dokploy, pelo titular) só depois de: conta de comerciante, produtos criados no Play Console,
  conta de serviço configurada e build com o plugin testado (faixa de teste interno).

## Pendências

- Reembolsos do Google (Real-time developer notifications / voided purchases): não implementado;
  hoje só a Apple revoga automaticamente.
