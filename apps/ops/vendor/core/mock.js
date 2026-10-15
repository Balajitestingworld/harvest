import { parseOffers } from "./offer-parser.js";
/**
 * Demo data so the app, website and backend work end-to-end before any
 * affiliate API keys exist. Prices and price history are generated
 * deterministically from the query; offer banners are illustrative, not real
 * current offers. Everything here is labelled "demo" in the UI.
 */
export const MERCHANTS = [
    { id: 'amazon_in', name: 'Amazon.in', tag: 'harvest-21' },
    { id: 'flipkart', name: 'Flipkart', tag: 'harvest' },
    { id: 'croma', name: 'Croma', tag: 'harvest' },
];
/** Sample banner text per store. The ingest job parses these like real ones. */
export const MOCK_BANNERS = {
    amazon_in: [
        '10% Instant Discount up to ₹1,500 on HDFC Bank Credit Cards. Min purchase value ₹5,000',
        '5% Instant Discount up to ₹1,000 on SBI Credit Card EMI transactions',
        'Flat ₹750 off on ICICI Bank Credit Cards on orders above ₹10,000',
        'Flat ₹75 cashback on UPI payments with PhonePe. Min order ₹1,000',
    ],
    flipkart: [
        '5% cashback on Axis Bank Credit Cards, max ₹750',
        '10% off up to ₹1,250 on ICICI Bank Debit Cards. Min order ₹7,500',
        'Flat ₹500 off on RuPay credit cards on purchases above ₹3,000',
        '5% reward points up to ₹500 via HDFC SmartBuy on HDFC Bank Credit Cards. Min order ₹5,000',
        'Use code FLIP200 for flat ₹200 off on orders above ₹4,000',
    ],
    croma: [
        '7.5% Instant Discount up to ₹3,000 on HDFC Bank Credit and Debit Cards',
        '₹1,000 off on Kotak Bank Credit Cards, min transaction ₹15,000. Cannot be combined with other offers',
        'Get ₹5,000 off with exchange of your old smartphone. Min order ₹20,000',
        'Pay with CRED UPI: 3% cashback up to ₹300 on orders above ₹2,000',
    ],
};
export function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
/** One store's demo listing for a query. */
export function mockListing(query, merchantId, index = 0) {
    const m = MERCHANTS.find((x) => x.id === merchantId) ?? { id: merchantId, name: merchantId, tag: '' };
    const q = query.trim();
    const seed = hash(q.toLowerCase());
    const base = 2000 + (seed % 78000); // ₹2,000 – ₹80,000
    const jitter = ((hash(q + m.id) % 900) - 450) / 10000; // ±4.5%
    const price = Math.round((base * (1 + jitter)) / 10) * 10 - 1;
    // Demo history: a different story per store so every verdict shows up.
    const story = hash(q + m.id + 'h') % 3;
    const median = Math.round(price * (story === 0 ? 1.08 : story === 1 ? 1.0 : 0.93));
    const stats = {
        samples: 24,
        days: 60,
        low: Math.round(median * 0.94),
        high: Math.round(median * 1.14),
        median,
    };
    if (story === 0)
        stats.low = Math.min(stats.low, price + 1);
    return {
        id: `${m.id}:${seed.toString(36)}`,
        merchantId: m.id,
        merchantName: m.name,
        title: q || 'Product',
        price,
        mrp: Math.round((price * 1.28) / 10) * 10,
        shipping: index === 2 && price < 5000 ? 99 : 0,
        currency: 'INR',
        affiliateUrl: mockAffiliateUrl(m.id, q),
        imageUrl: null,
        priceStats: stats,
    };
}
export function mockSearch(query, now = new Date()) {
    const q = query.trim();
    const listings = MERCHANTS.map((m, i) => mockListing(q, m.id, i));
    const offers = MERCHANTS.flatMap((m) => parseOffers(m.id, MOCK_BANNERS[m.id] ?? []).map((o) => ({ ...o, source: 'mock' })));
    return { query: q, cachedAt: now.toISOString(), listings, offers };
}
function mockAffiliateUrl(merchantId, q) {
    const enc = encodeURIComponent(q);
    switch (merchantId) {
        case 'amazon_in':
            return `https://www.amazon.in/s?k=${enc}&tag=harvest-21`;
        case 'flipkart':
            return `https://www.flipkart.com/search?q=${enc}&affid=harvest`;
        default:
            return `https://www.croma.com/searchB?q=${enc}`;
    }
}
