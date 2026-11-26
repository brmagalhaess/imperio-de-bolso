#!/bin/sh
# Restaura um backup criptografado num banco. ATENÇÃO: substitui o conteúdo do destino.
#   restore.sh <arquivo.dump.enc> <TARGET_DATABASE_URL>   (usa BACKUP_PASSPHRASE)
set -eu
FILE="${1:?informe o arquivo do backup}"
TARGET="${2:?informe a URL do banco de destino}"
: "${BACKUP_PASSPHRASE:?defina BACKUP_PASSPHRASE}"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" \
  | pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$TARGET"
echo "restauração ok: $FILE → banco de destino"
