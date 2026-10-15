/**
 * Light runtime check on the backend payload before the matching engine sees
 * it. Drops malformed items rather than crashing the results screen.
 */
export function parseSearchResponse(raw) {
    if (!raw || typeof raw !== 'object')
        throw new Error('Empty response from search service');
    const r = raw;
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    const str = (v) => typeof v === 'string' && v.length > 0;
    const listings = Array.isArray(r.listings)
        ? r.listings.filter((l) => l && str(l.id) && str(l.merchantId) && num(l.price) && l.price > 0 && str(l.affiliateUrl))
        : [];
    const offers = Array.isArray(r.offers)
        ? r.offers.filter((o) => o && str(o.id) && (o.kind === 'percent' || o.kind === 'flat') && num(o.value) && o.value > 0)
        : [];
    return {
        query: typeof r.query === 'string' ? r.query : '',
        cachedAt: typeof r.cachedAt === 'string' ? r.cachedAt : new Date(0).toISOString(),
        listings: listings.map((l) => ({ shipping: 0, currency: 'INR', ...l })),
        offers: offers.map((o) => ({ stackGroup: 'merchant', stackable: true, ...o })),
    };
}
