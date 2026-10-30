# Monitoring and health

POTHIK deliberately ships **no fake dashboards or fabricated metrics**. What exists is
real and can be wired into any external monitor:

| Signal | Where | Meaning |
| --- | --- | --- |
| `GET /api/v1/health/live` | API | Process is running (used by the Docker healthcheck) |
| `GET /api/v1/health/ready` | API | Process can reach MySQL; returns `503` otherwise |
| `GET /nginx-health` | Edge Nginx | Proxy is serving requests |
| `GET /healthz` | Frontend container | Static bundle is being served |
| Docker health state | `docker compose ps` | Per-container health from the checks above |
| Structured logs | `docker compose logs` | Pino JSON with request id, status, latency, error code |
| Audit trail | `GET /api/v1/admin/audit-logs` | Security and financial transitions |

There is currently **no Prometheus `/metrics` endpoint**. Add one deliberately
(for example `prom-client` with request histograms and queue depth) rather than
inventing numbers; until then, use uptime and log-based alerting.

## Recommended checks

1. **Uptime**: poll `/api/v1/health/ready` every minute from an external monitor;
   alert after 2 consecutive failures.
2. **Edge**: poll `/nginx-health` from the same monitor to distinguish proxy
   failure from API failure.
3. **Queue depth**: when Redis is enabled, inspect `bull:pothik:*` keys with
   `docker compose exec redis redis-cli keys 'bull:pothik:*'` and alert on a
   growing `wait` list. BullMQ also emits failed/completed events to the API log.
4. **Disk**: MySQL data, Redis AOF and the uploads volume all live on Docker
   volumes; alert above 80% usage.
5. **Backups**: run `scripts/backup.sh` from cron and alert when the newest file
   is older than 24 hours. Periodically restore a dump into a scratch database.
6. **TLS expiry**: standard certificate monitor on the public hostname.

## Log inspection

```bash
docker compose -f deployment/docker-compose.yml logs -f --tail=200 api-1 api-2
docker compose -f deployment/docker-compose.yml logs -f worker
docker compose -f deployment/docker-compose.yml ps
```

Every request log line carries `req.id` / `X-Request-Id`, so a failed request can
be traced from the edge through to the API replica that handled it. Logs rotate
at 10 MB × 3 files per container (`json-file` driver in the compose file).
