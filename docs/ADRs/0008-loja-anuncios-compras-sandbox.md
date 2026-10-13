# ADR 0008 — Loja, anúncios recompensados e compras em modo sandbox (Etapa 4)

- **Status:** aceita · 2026-10-13
- **Fontes:** docs/README.md §12; PROMPT_MESTRE (Etapa 4 e adendo itens 4–5); plano §23;
  conversa original (anúncio para dobrar ganhos, Passe VIP R$14,90, loja de diamantes);
  pedidos do titular (auto-coleta paga, pacotes de horas — ADR 0006).

## Decisões

- **Nunca transação real nesta etapa.** `STORE_MODE=mock` e `ADS_MODE=mock` em desenvolvimento;
  a API **se recusa a subir em produção com mock** (config). Tudo que é simulado é identificado
  na tela ("MODO DE TESTE", "ANÚNCIO DE TESTE", "COMPRA DE TESTE: nenhum valor será cobrado").
- **Catálogo** (`economy/store.ts`): diamantes R$4,90/9,90/19,90 (50/120/300); Passe VIP
  R$14,90/mês (auto-coleta em todos os mapas + selo); com diamantes: auto-coleta 24 h (20) e
  7 dias (100), turbo 1 h (10) e 4 h (30) de produção do mapa atual; grátis com anúncio:
  15 min de produção (5/dia). Valores em diamantes são proposta, ajustáveis no catálogo.
- **Compras em dinheiro:** `POST /purchases/verify` com interface `StoreVerifier`. O servidor
  verifica, grava `purchase_receipts` (único por loja+transação; recibo de outra conta é
  recusado) e concede diamantes ou assinatura (`subscriptions`, renovação a partir do
  vencimento). **Reembolso/estorno revoga**: diamantes saem até o saldo (nunca negativo) e a
  falta fica em `revoke_shortfall`; VIP reembolsado expira na hora. `POST /purchases/restore`.
- **Anúncios:** sessão criada no servidor (`POST /ads/start`, que calcula o prêmio e aplica
  limites) → anúncio exibido com `custom_data` = sessão → sessão confirmada por **SSV do AdMob
  com assinatura ECDSA verificada** (`GET /ads/ssv`, chaves públicas do Google em cache) ou,
  só em dev, por `POST /ads/mock-complete` → `POST /ads/claim` paga uma vez. O callback do
  cliente sozinho nunca paga. "Dobrar ganhos" vale uma vez por resumo, até 15 min depois,
  3 por dia.

## Plugins verificados (GitHub, 2026-10-13) e bloqueio explícito

| Integração | Candidato | Situação |
|---|---|---|
| AdMob (Android/iOS) | `poingstudios/godot-admob-plugin` v5.1.0 (2026-09) | mantido; avaliar licença, UMP/consentimento, ATT e compatibilidade com Godot 4.7 |
| Google Play Billing | `godot-sdk-integrations/godot-google-play-billing` 3.3.0 (2026-07) | organização oficial de integrações do Godot |
| Apple StoreKit 2 | `godot-sdk-integrations/godot-storekit2` (atualizado 2026-10) | idem; requer build iOS |

**Bloqueado até ação do titular:** conta Google Play Console (produtos e Play App Signing,
credencial de serviço para a Google Play Developer API), App Store Connect (produtos, chave da
App Store Server API), conta AdMob (apps e blocos de anúncio de teste) e aparelho físico.
Até lá, `google`/`apple` respondem `501 STORE_NOT_CONFIGURED` — nada de API inventada.
Próximo passo técnico: build com Gradle no Android, instalar os plugins, IDs de teste do AdMob,
e implementar os verificadores Google/Apple + notificações de reembolso (RTDN / App Store Server
Notifications) chamando `revokePurchase`.
