# Contrato da API v1

Base: `/api/v1`. JSON UTF-8. Datas em UTC ISO 8601 (`2026-01-01T12:00:00.000Z`).
Implementação: `backend/src/routes/v1.ts`. Testes: `backend/test/api.test.ts`.

## Convenções

- **Valores monetários são strings** (`"coins": "1500"`): saldos são BIGINT e não cabem com
  segurança em `double` (Godot/JS). Contagens pequenas (nível, segundos) são números.
- **Autenticação:** `Authorization: Bearer <accessToken>` em todas as rotas exceto `/auth/guest`.
  Token JWT curto (padrão 1h). Ao receber 401, o cliente reautentica com as credenciais salvas.
- **Comandos econômicos** (`POST` de compra, upgrade, coleta) exigem `Idempotency-Key`
  (8–128 caracteres `[A-Za-z0-9_-]`). Mesmo key + mesmo corpo → mesma resposta, sem reexecutar.
  Mesmo key + corpo diferente → `422 IDEMPOTENCY_KEY_REUSED`. Reenvie a **mesma** chave em
  novas tentativas após falha de rede.
- **Erros:** `{ "error": { "code": "...", "message": "...", "details": { ... } } }`.
  O cliente decide o texto pelo `code`; `message` é apenas referência.
- O servidor ignora campos não documentados no corpo (o cliente não informa tempo nem saldo).

## Endpoints

### `GET /health` (fora do prefixo)
`200 { status: "ok", serverTime }`

### `POST /auth/guest`
Corpo vazio → cria conta convidada (100 moedas). Corpo `{ guestId, guestSecret }` → retoma.
- `201` (nova) / `200` (retomada):
  `{ playerId, guestId, guestSecret?, accessToken, tokenType: "Bearer", expiresIn }`
  — `guestSecret` só vem na criação; o cliente deve guardá-lo.
- `401 INVALID_GUEST_CREDENTIALS`, `400 VALIDATION_ERROR`

### `GET /player/state`
`200 PlayerState`:
```json
{
  "player": { "id": "uuid", "displayName": "Empreendedor 1234", "tutorialCompleted": false },
  "wallet": { "coins": "100", "gems": "0" },
  "businesses": [Business, "... (10)"],
  "districts": [
    { "id": "praia", "unlocked": true, "requires": null },
    { "id": "cidade", "unlocked": false, "requires": "praia" }
  ],
  "serverTime": "ISO"
}
```

`Business`:
```json
{
  "slug": "agua", "name": "Carrinho de Água", "sortOrder": 1, "district": "praia",
  "cost": "100", "cycleSeconds": 10,
  "owned": true, "level": 1, "maxLevel": 100,
  "profitPerCycle": "10", "nextUpgradeCost": "115",
  "cycleStartedAt": "ISO|null", "cycleEndsAt": "ISO|null",
  "ready": false, "secondsRemaining": 7,
  "managed": false, "automatic": false, "managerCost": "150", "pendingAmount": "0"
}
```
Slugs atuais: `agua`, `pipoca`, `sorveteria`, `quiosque_coco` (Ilha da Praia), `mercadinho`,
`restaurante`, `supermercado`, `academia`, `hotel`, `shopping` (Cidade).

Não comprado: `owned: false`, `level: 0`, `profitPerCycle` do nível 1, `nextUpgradeCost: null`.

### `GET /businesses`
`200 { businesses: Business[], serverTime }`

**Auto-coleta ao vivo:** com auto-coleta ativa (Loja/VIP) e presença recente, comprar, melhorar
e contratar pagam antes os ciclos já completos dos ajudantes do mapa aberto (`production_auto`
no ledger) — o saldo usado é o mesmo que o jogo mostra (ele soma `pendingAmount` e os ciclos
locais dos negócios `automatic` do mapa aberto).

### `POST /businesses/purchase` — `Idempotency-Key`
Corpo `{ businessSlug }`. Debita `cost`, cria o negócio no nível 1 e inicia o primeiro ciclo.
- `201 { purchased, state: PlayerState }`
- `409 INSUFFICIENT_FUNDS { required, available }`, `409 BUSINESS_ALREADY_OWNED`,
  `409 DISTRICT_LOCKED { district, requires }` (falta comprar todos os negócios do distrito
  anterior), `404 BUSINESS_NOT_FOUND`

### `POST /businesses/upgrade` — `Idempotency-Key`
Corpo `{ businessSlug }`. Custo para o nível n: `round(cost × 1,15^(n−1))`.
- `200 { upgraded, level, state }`
- `409 INSUFFICIENT_FUNDS`, `409 BUSINESS_NOT_OWNED`, `409 MAX_LEVEL_REACHED`, `404`

### `POST /production/collect` — `Idempotency-Key`
Corpo `{ businessSlug? }` — sem slug coleta todos os prontos. Sem gerente, cada negócio
acumula **no máximo 1 ciclo**; a coleta credita `profitPerCycle` e reinicia o ciclo.
- `200 { collected: [{ slug, amount }], total, state }`
- `409 PRODUCTION_NOT_READY { slug, secondsRemaining }`, `409 NOTHING_TO_COLLECT`,
  `409 BUSINESS_NOT_OWNED`, `404`

### `POST /managers/hire` — `Idempotency-Key`
Corpo `{ businessSlug }`. Cobra `managerCost`. No mapa aberto o negócio segue manual e o ajudante
produz quando o jogador sair; fora do mapa já começa a produzir AFK.
- `200 { hired, state }`
- `409 BUSINESS_NOT_OWNED`, `409 MANAGER_ALREADY_HIRED`, `409 INSUFFICIENT_FUNDS`, `404`

### `POST /presence` — `Idempotency-Key`
Corpo `{ district }` (`praia` | `cidade` | `porto` | `centro`). Chamar ao abrir o jogo, ao trocar de mapa e a cada
~15 s. Sem sinal por 45 s o jogador conta como fora do mapa desde o último sinal (ADR 0006).
Ao entrar num mapa, paga o AFK dos negócios com ajudante dele (`clamp(agora − saída, 0, 4h)` +
sobra) e eles voltam ao ciclo manual; o mapa deixado passa a produzir AFK.
- `200 { district, returned, settled: [{ slug, cycles, amount }], total, elapsedSeconds, capped,
  capSeconds, state }` — `returned: false` quando o jogador já estava no mapa.
- `404 DISTRICT_NOT_FOUND`
Negócio com `automatic: true` (AFK ou auto-coleta) não tem bolha; `pendingAmount` é o AFK ainda
não pago (só leitura). `POST /production/collect` nele → `409 MANAGER_ACTIVE`. Melhorar liquida
antes de subir de nível. `player.currentDistrict` e `player.autoCollect` vêm no estado.

### `POST /tutorial/complete`
Sem Idempotency-Key (não mexe em saldo); idempotente. `200 PlayerState` com
`player.tutorialCompleted: true`.

### `GET /missions`
`200 { day, resetsAt, missions: [{ id, template, title, titleTemplate, target, progress, completed,
claimed, rewardCoins, rewardGems }], serverTime }` — 3 missões do dia (Brasília), criadas na 1ª
consulta. Missões por fase do jogador (número de negócios): alvos crescem; "colete" só para quem
tem moeda para tocar; construir/contratar só se der para pagar em até 30 min de renda; no máximo
uma de faturar por dia. Modelos: `collect_times`, `earn_coins`, `earn_big`, `upgrade_times`,
`buy_business`, `hire_helper`, `afk_collect`, `visit_city`, `watch_ads`. `title` vem pronto em pt-BR; `titleTemplate` traz o modelo com `{n}` (ex.: "Fature {n}
moedas"), que o cliente traduz e preenche com `target` no formato do idioma (V1.2).

Textos de catálogo (nomes de negócios, títulos/descrições de conquistas, itens da Loja) seguem em
pt-BR e servem de chave de tradução no cliente (`game/i18n/translations.csv`).

### `POST /missions/claim` — `Idempotency-Key`
Corpo `{ missionId }`. `200 { claimed, missions, state }`. `409 MISSION_NOT_COMPLETED`,
`409 MISSION_ALREADY_CLAIMED`, `404 MISSION_NOT_FOUND` (de outro jogador ou de outro dia).

### `GET /achievements`
`200 { achievements: [{ id, title, description, rewardGems, progress, target, unlocked, claimed }] }`.

### `POST /achievements/claim` — `Idempotency-Key`
Corpo `{ achievementId }`. `200 { claimed, achievements, state }`. `409 ACHIEVEMENT_LOCKED`,
`409 ACHIEVEMENT_ALREADY_CLAIMED`, `404 ACHIEVEMENT_NOT_FOUND`.

### `GET /leaderboard`
`200 { week: { start, end }, entries: [{ rank, displayName, score, isMe }], me, serverTime }` —
faturamento de produção na semana (segunda 00:00 Brasília), top 50; `me` é null se o jogador
não faturou na semana.

### `POST /analytics/events`
Corpo `{ events: [{ name, props? }] }` (1–20). Nomes permitidos: `tutorial_started`,
`tutorial_step`, `tutorial_skipped`, `screen_view`, `crash`. `202 { accepted }`.

### Loja, compras e anúncios (ADR 0008)
- `GET /store/catalog?district=praia` → `{ sandbox, district, items (coleta antecipada com
  `estimateCoins`; anúncio com `usedToday`/`dailyLimit`), entitlements: { autoCollectUntil, vipUntil,
  vipDailyGems, vipDailyClaimed }, serverTime }`.
- `POST /vip/daily` — `Idempotency-Key`. `{}` → `200 { gems, state }`. `409 VIP_REQUIRED`,
  `409 VIP_DAILY_CLAIMED`.
- `POST /store/buy` — `Idempotency-Key`. `{ itemId, district? }` (auto-coleta/turbo com
  diamantes) → `200 { bought, autoCollectUntil? | coins?, state }`. `409 INSUFFICIENT_FUNDS`,
  `409 NOTHING_TO_BOOST`, `404 STORE_ITEM_NOT_FOUND`.
- `POST /purchases/verify` — `Idempotency-Key`. `{ store: mock|google|apple, productId,
  purchaseToken }` → `201 { receipt, product, gems, state }` (recibo repetido: `200 { duplicate }`).
  `409 PURCHASE_OWNED_BY_OTHER`, `422 PURCHASE_INVALID`, `404 PRODUCT_NOT_FOUND`,
  `403 MOCK_DISABLED`, `501 STORE_NOT_CONFIGURED` (google/apple até as contas existirem).
- `POST /purchases/restore` → `{ purchases, activeSubscriptions }`.
- `POST /ads/start` — `Idempotency-Key`. `{ placement: ad_boost|offline_double, district? }` →
  `201 { sessionId, rewardCoins, expiresAt }`. `409 AD_DAILY_LIMIT`, `409 AD_NOT_AVAILABLE`.
- `GET /ads/ssv` (Google, sem login, assinatura ECDSA) → `200 { verified }` · `400 SSV_INVALID`.
- `POST /ads/claim` — `Idempotency-Key`. `{ sessionId }` → `200 { claimed, coins, state }`.
  `409 AD_NOT_VERIFIED`, `409 AD_ALREADY_CLAIMED`.
- Somente modo mock: `POST /ads/mock-complete { sessionId }`, `POST /purchases/mock/refund
  { transactionId }` (simula reembolso da loja).
`player` no estado ganha `autoCollectUntil` e `vipUntil`.

### `POST /player/name`
`{ displayName }` → `200 PlayerState` (`player.canChangeName: false`). Uma vez por conta.
`422 NAME_INVALID`, `422 NAME_NOT_ALLOWED`, `409 NAME_TAKEN`, `409 NAME_ALREADY_CHANGED`.

### `GET /prestige` · `POST /prestige` (ADR 0011)
`GET` → `{ stars, bonusPercent, count, earnedSinceLast, starsToGain, nextBonusPercent, requires,
requirementMet, available }`. `POST` (comando, `Idempotency-Key`) vende o império →
`200 { gained, prestige, state }`; `409 PRESTIGE_NOT_AVAILABLE` sem a cidade completa ou sem
estrela a ganhar. `PlayerState.player` ganha `prestigeStars` e `prestigeBonusPercent`; o
`profitPerCycle` dos negócios já vem com o bônus.

### `POST /player/delete`
`{ confirm: "EXCLUIR" }` → `200 { deleted: true }`. Irreversível (ADR 0009): apaga jogador,
carteira, ledger, negócios, missões, conquistas, anúncios e eventos. Recibos/assinaturas ficam
sem dono. Depois disso o token e as credenciais de convidado respondem `401`.
`400 VALIDATION_ERROR` sem a confirmação exata.

`POST /purchases/verify` de uma **assinatura** cujo recibo ficou sem dono (conta excluída) →
`200 { relinked: true, receipt, state }`; recibo de diamantes nessa situação →
`409 PURCHASE_OWNED_BY_OTHER`.

Qualquer rota: `429 RATE_LIMITED` `{ retryAfterSeconds }` acima do limite por IP.

### Admin — `/api/admin/*` (fora do `/api/v1`)
`Authorization: Bearer <ADMIN_TOKEN>`; desligado sem token. Somente leitura:
`GET /overview`, `GET /players?search&limit`, `GET /players/:id`, `GET /events?name&limit`.

### Ainda não implementados (docs/README.md §11)
`POST /auth/link`, `GET /config`.
