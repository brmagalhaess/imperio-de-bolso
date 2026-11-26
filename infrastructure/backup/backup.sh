#!/bin/sh
# Gera backup criptografado do banco. Variáveis:
#   DATABASE_URL       postgresql://usuario:senha@host:5432/banco (obrigatória)
#   BACKUP_PASSPHRASE  frase para AES-256 (obrigatória; guarde fora do servidor também)
#   BACKUP_DIR         destino (padrão /backups) · BACKUP_KEEP quantos manter (padrão 14)
set -eu
: "${DATABASE_URL:?defina DATABASE_URL}"
: "${BACKUP_PASSPHRASE:?defina BACKUP_PASSPHRASE}"
DIR="${BACKUP_DIR:-/backups}"
KEEP="${BACKUP_KEEP:-14}"
mkdir -p "$DIR"
FILE="$DIR/imperio-$(date -u +%Y%m%dT%H%M%SZ).dump.enc"
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
echo "backup ok: $FILE ($(wc -c < "$FILE") bytes)"
# Rotação: mantém os $KEEP mais recentes.
ls -1t "$DIR"/imperio-*.dump.enc 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  rm -f -- "$old" && echo "removido backup antigo: $old"
done
