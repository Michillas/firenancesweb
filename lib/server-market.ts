import "server-only";
import { createMarket, type FetchLike } from "@/core/market/service";

export const market = createMarket(fetch as unknown as FetchLike);

// Tiny in-memory TTL cache: public market APIs rate-limit per IP, and several holdings / tabs
// ask for the same data. Single-instance only, which is what a personal app needs.
const cache = new Map<string, { at: number; value: unknown }>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 2000) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 500);
    for (const [k] of oldest) cache.delete(k);
  }
  return value;
}
