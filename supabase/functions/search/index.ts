/**
 * GET /functions/v1/search?q=<product>
 *
 * Anonymous search (R-002): the request carries only the query string. The
 * response carries one listing per store plus every live offer for those
 * stores — the app decides locally which ones the user can use.
 */
import { ADAPTERS, loadMerchants, type Merchant } from '../_shared/adapters.ts';
import { cacheGet, cacheKey, cacheSet } from '../_shared/cache.ts';
import { db, dbConfigured } from '../_shared/db.ts';
import { corsHeaders, json, withTimeout } from '../_shared/http.ts';
import { logSearch } from '../_shared/telemetry.ts';
import { isLive } from '../_shared/core/matching.ts';
import { MOCK_BANNERS } from '../_shared/core/mock.ts';
import { parseOffers } from '../_shared/core/offer-parser.ts';
import { summarizePrices } from '../_shared/core/price.ts';
import { normalizeQuery, rowToOffer, type OfferRow } from '../_shared/core/server/rows.ts';
import type { Listing, Offer, SearchResponse } from '../_shared/core/types.ts';

const ADAPTER_TIMEOUT_MS = 2500; // leaves headroom inside the 3s budget (BR-007)
const HISTORY_DAYS = 90;
/** Don't record another price point for a store more often than this. */
const MIN_SAMPLE_GAP_MS = 6 * 60 * 60 * 1000;

async function liveOffers(merchants: Merchant[]): Promise<Offer[]> {
  if (!dbConfigured) {
    // Demo mode: parse the built-in sample banners.
    return merchants.flatMap((m) => parseOffers(m.id, MOCK_BANNERS[m.id] ?? []));
  }
  const rows = await db.select<OfferRow>('offers', 'status=eq.live&select=*');
  const ids = new Set(merchants.map((m) => m.id));
  return rows
    .filter((r) => r.merchant_id == null || ids.has(r.merchant_id))
    .map(rowToOffer)
    .filter((o) => isLive(o));
}

/** Attach 90-day price stats per store, and record today's prices. */
async function withHistory(queryKey: string, listings: Listing[]): Promise<Listing[]> {
  if (!dbConfigured || !listings.length) return listings;
  const since = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString();
  let rows: { merchant_id: string; price: number; seen_at: string }[] = [];
  try {
    rows = await db.select(
      'price_history',
      `query_key=eq.${encodeURIComponent(queryKey)}&seen_at=gte.${encodeURIComponent(since)}&select=merchant_id,price,seen_at&order=seen_at.desc&limit=2000`,
    );
  } catch (e) {
    console.warn('price history read failed', e);
  }
  const fresh: unknown[] = [];
  const out = listings.map((l) => {
    const mine = rows.filter((r) => r.merchant_id === l.merchantId);
    const latest = mine[0] ? Date.parse(mine[0].seen_at) : 0;
    if (Date.now() - latest > MIN_SAMPLE_GAP_MS) {
      fresh.push({ query_key: queryKey, merchant_id: l.merchantId, price: l.price, mrp: l.mrp ?? null });
    }
    return { ...l, priceStats: summarizePrices(mine.map((r) => ({ price: Number(r.price), seenAt: r.seen_at }))) };
  });
  db.insert('price_history', fresh).catch((e) => console.warn('price history write failed', e));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'Use GET' }, 405);

  const q = (new URL(req.url).searchParams.get('q') ?? '').replace(/\s+/g, ' ').trim();
  if (q.length < 2 || q.length > 120) return json({ error: 'Query must be 2–120 characters' }, 400);
  // Never accept something that looks like a card number as a search string.
  if (/(?:\d[\s\-.]?){12,}/.test(q)) return json({ error: 'Query looks like a card number' }, 400);

  const key = cacheKey(q);
  const cached = await cacheGet<SearchResponse>(key).catch(() => null);
  if (cached) {
    logSearch(q, cached.listings.length, true);
    return json(cached, 200, { 'X-Cache': 'HIT' });
  }

  let merchants: Merchant[];
  try {
    merchants = await loadMerchants();
  } catch (e) {
    console.error('merchant list unavailable', e);
    return json({ error: 'Search is temporarily unavailable. Try again in a minute.' }, 503);
  }

  const settled = await Promise.allSettled(
    merchants.map((m, i) => {
      const adapter = ADAPTERS[m.adapter];
      if (!adapter) return Promise.reject(new Error(`unknown adapter "${m.adapter}"`));
      return withTimeout(adapter.search(q, m, i), ADAPTER_TIMEOUT_MS, m.id);
    }),
  );

  let listings: Listing[] = [];
  const errors: string[] = [];
  settled.forEach((s, i) => {
    const m = merchants[i]!;
    if (s.status === 'fulfilled') {
      if (s.value) listings.push(s.value);
    } else {
      errors.push(`${m.id}: ${String(s.reason?.message ?? s.reason)}`);
      if (dbConfigured) {
        db.patch('merchants', `id=eq.${m.id}`, { last_error: errors.at(-1), last_error_at: new Date().toISOString() }).catch(() => {});
      }
    }
  });
  if (errors.length) console.warn('adapter errors', errors);

  const queryKey = normalizeQuery(q);
  listings = await withHistory(queryKey, listings);
  let offers: Offer[] = [];
  try {
    offers = await liveOffers(merchants);
  } catch (e) {
    console.error('offers unavailable', e);
    return json({ error: 'Search is temporarily unavailable. Try again in a minute.' }, 503);
  }

  const body: SearchResponse = { query: q, cachedAt: new Date().toISOString(), listings, offers };

  // Only cache complete-ish results so a transient failure isn't pinned.
  if (listings.length && errors.length < merchants.length) {
    const ttl = Math.min(...merchants.map((m) => m.cache_minutes)) * 60;
    await cacheSet(key, body, ttl).catch(() => {});
  }
  logSearch(q, listings.length, false);
  return json(body, 200, { 'X-Cache': 'MISS' });
});
