#!/usr/bin/env bash
# Poll the public entry point until the API reports ready.
# Use in CI smoke tests, cron or an external uptime monitor.
#
#   PUBLIC_URL=https://pothik.example.com ./scripts/healthcheck.sh
set -euo pipefail

base="${PUBLIC_URL:-http://localhost}"
url="${base%/}/api/v1/health/ready"
attempts="${ATTEMPTS:-30}"
delay="${DELAY_SECONDS:-2}"

for attempt in $(seq 1 "$attempts"); do
  body="$(curl -fsS --max-time 5 "$url" 2>/dev/null || true)"
  if printf '%s' "$body" | grep -q '"success":true'; then
    printf 'ready: %s\n%s\n' "$url" "$body"
    exit 0
  fi
  echo "waiting for $url ($attempt/$attempts)"
  sleep "$delay"
done

echo "health check failed: $url" >&2
exit 1
