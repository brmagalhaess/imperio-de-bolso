# ADR 0009 — Beta Android: segurança, backups, conta recuperável e exclusão de conta (Etapa 5)

- **Status:** aceita · 2026-10-13
- **Fontes:** docs/README.md (Etapa 5 e §segurança: backups testados, logs sem PII, exclusão de
  conta, LGPD); plano §24 (Dockploy, backups) e §28 (guest account recuperável, exclusão com
  exceções legais, rate limiting); PROMPT_MESTRE (Etapa 5).

## Decisões

- **API endurecida:** rate limit por IP (geral 600/min; `/auth/guest` 20/min), helmet, corpo
  máximo 16 KB, logs só com método e caminho, `TRUST_PROXY` atrás do Traefik. 429 sai no
  formato padrão (`RATE_LIMITED`, `retryAfterSeconds`).
- **Teste fechado sem cobrança:** `BETA_SANDBOX=true` é o único jeito de rodar loja/anúncios
  mock com `NODE_ENV=production` (staging). Produção pública fica com `false`.
- **Backups:** serviço `backup` (pg_dump custom → AES-256 com PBKDF2, rotação, cron) e
  `verify-restore.sh` que restaura num banco descartável e compara contagens e saldo total.
- **Conta convidada recuperável no Android:** `user_data_backup/allow=true` (Backup automático
  do Google) — `user://session.cfg` volta ao reinstalar ou trocar de aparelho. Vínculo com
  Google/Apple (`/auth/link`) continua no backlog.
- **Exclusão de conta** (`POST /player/delete`, confirmação `"EXCLUIR"`): apaga o jogador e
  todos os dados de jogo e de analytics dele, numa transação que trava a carteira (espera
  comandos em andamento). Fica só um evento anônimo `account_deleted`. JWT ainda válido de
  conta excluída é recusado (checagem de existência no `authenticate`).
- **Exceção:** `purchase_receipts` e `subscriptions` ficam com `player_id` nulo (sem dado
  pessoal), para impedir reuso do mesmo recibo de diamantes e para processar reembolsos.
  Assinatura ativa de conta excluída é **religada** à conta que reenviar o recibo
  ("Restaurar compras" com a loja real); diamantes não voltam.
- **Release:** preset "Android Release" (Gradle, AAB). A keystore de upload fica em
  `~/.imperio/keys/` (fora do Git, chmod 600); o Play App Signing guarda a chave de app.

## Consequências

- Play Console exige também um **link web** para pedir exclusão: entra com a landing.
- Com o Backup do Google, o segredo do convidado é guardado criptografado na conta Google do
  jogador; quem limpa os dados do app sem backup perde a conta (avisar no FAQ).
