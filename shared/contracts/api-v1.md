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
  "player": { "id": "uuid", "displayName": "Empreendedor 1234" },
  "wallet": { "coins": "100", "gems": "0" },
  "businesses": [Business, "... (10)"],
  "serverTime": "ISO"
}
```

`Business`:
```json
{
  "slug": "agua", "name": "Carrinho de Água", "sortOrder": 1,
  "cost": "100", "cycleSeconds": 10,
  "owned": true, "level": 1, "maxLevel": 100,
  "profitPerCycle": "10", "nextUpgradeCost": "115",
  "cycleStartedAt": "ISO|null", "cycleEndsAt": "ISO|null",
  "ready": false, "secondsRemaining": 7
}
```
Slugs atuais: `agua`, `pipoca`, `sorveteria`, `quiosque_coco` (Ilha da Praia), `mercadinho`,
`restaurante`, `supermercado`, `academia`, `hotel`, `shopping` (Cidade).

Não comprado: `owned: false`, `level: 0`, `profitPerCycle` do nível 1, `nextUpgradeCost: null`.

### `GET /businesses`
`200 { businesses: Business[], serverTime }`

### `POST /businesses/purchase` — `Idempotency-Key`
Corpo `{ businessSlug }`. Debita `cost`, cria o negócio no nível 1 e inicia o primeiro ciclo.
- `201 { purchased, state: PlayerState }`
- `409 INSUFFICIENT_FUNDS { required, available }`, `409 BUSINESS_ALREADY_OWNED`,
  `404 BUSINESS_NOT_FOUND`

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

### Ainda não implementados (docs/README.md §11)
`POST /auth/link`, `GET /missions`, `POST /missions/claim`, `GET /leaderboard`,
`GET /store/catalog`, `POST /purchases/verify`, `GET /config`.
