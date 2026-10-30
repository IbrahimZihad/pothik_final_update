export function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `pothik-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
