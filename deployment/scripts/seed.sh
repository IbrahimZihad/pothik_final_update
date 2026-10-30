#!/usr/bin/env bash
# Seed demo data. Requires SEED_DEMO_PASSWORD and ADMIN_PASSWORD in deployment/.env.
# Safe to run more than once: seeders use idempotent findOrCreate/update flows.
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker compose --profile seed run --rm seed
