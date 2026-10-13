# Backups do PostgreSQL (plano §24/§28): pg_dump comprimido + criptografado, rotação e
# verificação de restauração. Mesma versão do Postgres do banco.
FROM postgres:17-alpine
RUN apk add --no-cache openssl
COPY backup.sh restore.sh verify-restore.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/verify-restore.sh
# Agendamento: BACKUP_CRON (padrão: todo dia 03:30 UTC).
CMD ["sh", "-c", "echo \"${BACKUP_CRON:-30 3 * * *} /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1\" | crontab - && crond -f -l 8"]
