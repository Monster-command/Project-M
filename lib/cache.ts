/** Tiny in-memory TTL cache. Route handlers wrap MCP calls with this so we
 *  never hammer NSE's servers: live data 60s, end-of-day bhavcopy data 6h. */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

// Bound the map so a long-running process can't grow it forever.
const MAX_ENTRIES = 2000;

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await fn();
  if (store.size >= MAX_ENTRIES) {
    // Evict the oldest-looking entries (simple FIFO-ish sweep).
    const keys = store.keys();
    for (let i = 0; i < 200; i++) {
      const k = keys.next();
      if (k.done) break;
      store.delete(k.value);
    }
  }
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export const TTL = {
  /** Live quotes / indices / movers (server refreshes every 1–5 min). */
  live: 60_000,
  /** End-of-day bhavcopy data never changes once published. */
  eod: 6 * 60 * 60_000,
  /** Symbol search results. */
  search: 10 * 60_000,
} as const;

/** Wrap a payload with freshness metadata for the UI. */
export function withFreshness<T>(data: T, asOf: string | null, stale: boolean) {
  return { data, asOf, stale };
}
