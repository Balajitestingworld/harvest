const DAY = 24 * 60 * 60 * 1000;
export const HISTORY_WINDOW_DAYS = 90;
/** Below this we say "not enough history" instead of guessing. */
export const MIN_SAMPLES = 5;
export const MIN_DAYS = 7;
function median(sorted) {
    const n = sorted.length;
    if (!n)
        return 0;
    const mid = Math.floor(n / 2);
    return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
/**
 * Turn raw price rows (one per cache refresh) into the summary the app needs.
 * Runs on the server; rows carry only a product query, store and price.
 */
export function summarizePrices(rows, now = new Date()) {
    const since = now.getTime() - HISTORY_WINDOW_DAYS * DAY;
    const pts = rows
        .map((r) => ({ price: r.price, t: Date.parse(r.seenAt) }))
        .filter((r) => Number.isFinite(r.price) && r.price > 0 && Number.isFinite(r.t) && r.t >= since && r.t <= now.getTime() + DAY);
    if (!pts.length)
        return null;
    const prices = pts.map((p) => p.price).sort((a, b) => a - b);
    const first = Math.min(...pts.map((p) => p.t));
    return {
        samples: pts.length,
        days: Math.max(1, Math.ceil((now.getTime() - first) / DAY)),
        low: prices[0],
        high: prices[prices.length - 1],
        median: median(prices),
    };
}
const pct = (a, b) => Math.round(((a - b) / b) * 100);
/**
 * Is today's price actually good? Compares against this store's own history.
 * Also flags "sales" whose crossed-out price is one the store hasn't charged.
 */
export function checkPrice(listing) {
    const s = listing.priceStats;
    if (!s || s.samples < MIN_SAMPLES || s.days < MIN_DAYS) {
        return { verdict: 'unknown', fakeSale: false, note: 'Price history is still building for this product.' };
    }
    const price = listing.price;
    const mrp = listing.mrp ?? null;
    const claimed = mrp && mrp > price ? (mrp - price) / mrp : 0;
    // The store's "was" price is higher than anything it charged in the window.
    const fakeSale = !!mrp && claimed >= 0.15 && s.high < mrp * 0.9;
    let verdict;
    let note;
    if (price <= s.low) {
        verdict = 'lowest';
        note = `Lowest price in the last ${s.days} days.`;
    }
    else if (price <= s.median * 0.95) {
        verdict = 'good';
        note = `${Math.abs(pct(price, s.median))}% below its usual price.`;
    }
    else if (price >= s.median * 1.1) {
        verdict = 'high';
        note = `${pct(price, s.median)}% above its usual price. It may drop.`;
    }
    else {
        verdict = 'typical';
        note = 'About what this usually costs.';
    }
    if (fakeSale) {
        note += ` The crossed-out price hasn't been charged here in ${s.days} days, so the discount isn't a new drop.`;
    }
    return { verdict, note, fakeSale };
}
