import type { SearchResponse } from './types.ts';

/**
 * Light runtime check on the backend payload before the matching engine sees
 * it. Drops malformed items rather than crashing the results screen.
 */
export function parseSearchResponse(raw: unknown): SearchResponse {
  if (!raw || typeof raw !== 'object') throw new Error('Empty response from search service');
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const str = (v: unknown) => typeof v === 'string' && v.length > 0;

  const listings = Array.isArray(r.listings)
    ? r.listings.filter(
        (l: any) => l && str(l.id) && str(l.merchantId) && num(l.price) && l.price > 0 && str(l.affiliateUrl),
      )
    : [];
  const offers = Array.isArray(r.offers)
    ? r.offers.filter(
        (o: any) =>
          o && str(o.id) && (o.kind === 'percent' || o.kind === 'flat') && num(o.value) && o.value > 0,
      )
    : [];

  return {
    query: typeof r.query === 'string' ? r.query : '',
    cachedAt: typeof r.cachedAt === 'string' ? r.cachedAt : new Date(0).toISOString(),
    listings: listings.map((l: any) => ({ shipping: 0, currency: 'INR', ...l })),
    offers: offers.map((o: any) => ({ stackGroup: 'merchant', stackable: true, ...o })),
  } as SearchResponse;
}
