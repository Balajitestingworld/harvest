/**
 * Query-keyed cache (PRD: Caching). Uses Upstash Redis over REST when
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set, otherwise a
 * per-isolate in-memory map (fine for local dev, not shared across instances).
 * Keys contain only the normalised search string — never user data.
 */
import { normalizeQuery } from './core/server/rows.ts';

const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
const memory = new Map<string, { expires: number; value: string }>();

export function cacheKey(query: string): string {
  return `search:v2:${normalizeQuery(query)}`;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (url && token) {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result: string | null };
    return body.result ? (JSON.parse(body.result) as T) : null;
  }
  const hit = memory.get(key);
  if (!hit || hit.expires < Date.now()) return null;
  return JSON.parse(hit.value) as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const str = JSON.stringify(value);
  if (url && token) {
    await fetch(`${url}/set/${encodeURIComponent(key)}?EX=${ttlSeconds}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: str,
    });
    return;
  }
  memory.set(key, { value: str, expires: Date.now() + ttlSeconds * 1000 });
}
