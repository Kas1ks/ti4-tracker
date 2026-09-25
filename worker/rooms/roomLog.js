/**
 * Structured room diagnostics for Worker + Vite memory backend.
 * One JSON line per event — easy to grep in Cloudflare logs.
 */
export function logRoomEvent(event, fields = {}) {
  try {
    const payload = {
      ts: new Date().toISOString(),
      event,
      ...fields,
    };
    console.log(`[rooms] ${JSON.stringify(payload)}`);
  } catch {
    /* never throw from logging */
  }
}

export function measureMs(startedAt) {
  return Math.max(0, Date.now() - startedAt);
}
