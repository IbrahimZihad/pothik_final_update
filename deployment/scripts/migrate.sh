#!/usr/bin/env bash
# Apply all pending migrations against the compose MySQL instance.
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker compose run --rm migrate
