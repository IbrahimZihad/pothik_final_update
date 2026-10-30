#!/usr/bin/env bash
# Dump the POTHIK database to deployment/backups and prune old dumps.
#
#   ./scripts/backup.sh
#   BACKUP_RETENTION_DAYS=30 ./scripts/backup.sh
#
# The dump runs inside the MySQL container so no client tools are needed on the
# host. Restore with:
#   gunzip -c deployment/backups/pothik-YYYYmmdd-HHMMSS.sql.gz \
#     | docker compose exec -T mysql sh -c \
#       'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
target="backups/pothik-${stamp}.sql.gz"

docker compose exec -T mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --events "$MYSQL_DATABASE"' \
  | gzip -9 > "$target"

echo "backup written: deployment/${target} ($(du -h "$target" | cut -f1))"

retention="${BACKUP_RETENTION_DAYS:-14}"
find backups -name 'pothik-*.sql.gz' -type f -mtime "+${retention}" -print -delete
