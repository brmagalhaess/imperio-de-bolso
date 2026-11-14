#!/bin/sh
# Teste de restauração (plano §24): restaura o backup mais recente num banco temporário e
# compara a contagem de linhas das tabelas principais com o banco de origem.
#   DATABASE_URL (origem), SCRATCH_DATABASE_URL (banco descartável), BACKUP_PASSPHRASE, BACKUP_DIR
set -eu
: "${DATABASE_URL:?}" "${SCRATCH_DATABASE_URL:?}" "${BACKUP_PASSPHRASE:?}"
DIR="${BACKUP_DIR:-/backups}"
LATEST="$(ls -1t "$DIR"/imperio-*.dump.enc | head -n 1)"
echo "verificando: $LATEST"
psql "$SCRATCH_DATABASE_URL" -qc "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
/usr/local/bin/restore.sh "$LATEST" "$SCRATCH_DATABASE_URL" >/dev/null
SQL="SELECT 'players', count(*) FROM players UNION ALL SELECT 'wallet_ledger', count(*) FROM wallet_ledger
     UNION ALL SELECT 'player_businesses', count(*) FROM player_businesses
     UNION ALL SELECT 'purchase_receipts', count(*) FROM purchase_receipts
     UNION ALL SELECT 'saldo_total', COALESCE(sum(coins), 0) FROM player_wallets ORDER BY 1;"
SRC="$(psql "$DATABASE_URL" -tAc "$SQL")"
DST="$(psql "$SCRATCH_DATABASE_URL" -tAc "$SQL")"
echo "$DST" | sed 's/^/  /'
if [ "$SRC" = "$DST" ]; then echo "RESTAURAÇÃO VERIFICADA: dados idênticos"; else
  echo "DIVERGÊNCIA entre origem e restauração" >&2; echo "origem:" >&2; echo "$SRC" >&2; exit 1; fi
