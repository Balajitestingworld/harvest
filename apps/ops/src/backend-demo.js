// Demo backend: sample data in memory. Nothing leaves the page, nothing is saved.
import { MOCK_BANNERS, classifyBanners, fingerprint, parseOfferText, rowToOffer } from '../vendor/core/index.js';

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
let nextId = 1000;

const state = {
  user: null,
  merchants: [
    { id: 'amazon_in', name: 'Amazon.in', enabled: true, adapter: 'mock', affiliate_tag: null, allowed_hosts: ['amazon.in', 'www.amazon.in'], cache_minutes: 90, offer_page_url: null, auto_publish_min: null, last_ok_at: iso(0.05), last_error: null },
    { id: 'flipkart', name: 'Flipkart', enabled: true, adapter: 'mock', affiliate_tag: null, allowed_hosts: ['flipkart.com', 'www.flipkart.com'], cache_minutes: 90, offer_page_url: null, auto_publish_min: 0.75, last_ok_at: iso(0.05), last_error: null },
    { id: 'croma', name: 'Croma', enabled: true, adapter: 'mock', affiliate_tag: null, allowed_hosts: ['croma.com', 'www.croma.com'], cache_minutes: 90, offer_page_url: null, auto_publish_min: null, last_ok_at: iso(1.2), last_error: 'scraper returned 403' },
  ],
  offers: [],
  failures: [
    { id: 1, merchant_id: 'croma', raw_text: 'Free delivery on orders above ₹499', resolved: false, created_at: iso(0.1) },
    { id: 2, merchant_id: 'flipkart', raw_text: 'Earn 5X reward points on HDFC SmartBuy', resolved: false, created_at: iso(0.1) },
  ],
  refreshed: false,
};

async function seed() {
  for (const m of state.merchants) {
    const r = await classifyBanners({ merchantId: m.id, banners: MOCK_BANNERS[m.id] ?? [], autoPublishMin: m.auto_publish_min });
    for (const row of r.rows) state.offers.push({ ...row, id: String(nextId++), created_at: iso(0.1), last_seen_at: iso(0.05) });
  }
  const manual = (over) => ({
    id: String(nextId++), merchant_id: null, status: 'live', source: 'manual', kind: 'flat', value: 100, max_cap: null, min_spend: 1000,
    issuer: null, network: null, card_type: null, tiers: null, payment_app: 'gpay', portal: null, code: null, stack_group: 'payment',
    stackable: true, emi_only: false, requires_exchange: false, reward_kind: 'cashback', label: 'Google Pay: ₹100 cashback on orders above ₹1,000',
    raw_text: null, confidence: null, valid_from: null, valid_until: null, fingerprint: null, created_at: iso(5), ...over,
  });
  state.offers.push(
    manual({}),
    manual({ id: String(nextId++), merchant_id: 'amazon_in', payment_app: null, issuer: 'sbi', stack_group: 'bank', kind: 'percent', value: 10, max_cap: 1250, label: 'SBI Card: 10% off up to ₹1,250 (festive)', reward_kind: 'instant', valid_until: iso(3), status: 'expired' }),
    manual({ id: String(nextId++), merchant_id: 'flipkart', payment_app: null, issuer: 'yes', stack_group: 'bank', kind: 'percent', value: 90, max_cap: null, label: 'YES Bank: 90% off', reward_kind: 'instant', status: 'rejected', source: 'regex', confidence: 0.2 }),
  );
}
await seed();

const rowFp = (r) => fingerprint(r.merchant_id, { kind: r.kind, value: Number(r.value), maxCap: r.max_cap, minSpend: r.min_spend, issuer: r.issuer, network: r.network, cardType: r.card_type, paymentApp: r.payment_app, portal: r.portal, code: r.code, emiOnly: r.emi_only, requiresExchange: r.requires_exchange, rewardKind: r.reward_kind });

export const demo = {
  mode: 'demo',
  async session() { return state.user; },
  async signIn(email) { state.user = { email: email || 'demo@harvest.test' }; return { signedIn: true }; },
  async signOut() { state.user = null; },

  async stats() {
    const count = (s) => state.offers.filter((o) => o.status === s).length;
    return {
      pending: count('pending'), live: count('live'), expired: count('expired'), rejected: count('rejected'),
      failures: state.failures.filter((f) => !f.resolved).length,
      storesWithErrors: state.merchants.filter((m) => m.last_error).length,
    };
  },

  async listMerchants() { return structuredClone(state.merchants); },
  async saveMerchant(id, patch) { Object.assign(state.merchants.find((m) => m.id === id), patch); },
  async createMerchant(m) {
    if (state.merchants.some((x) => x.id === m.id)) throw new Error('A store with that ID already exists.');
    state.merchants.push({ enabled: true, cache_minutes: 90, offer_page_url: null, auto_publish_min: null, affiliate_tag: null, last_ok_at: null, last_error: null, ...m });
  },

  async listOffers({ status, merchantId, search } = {}) {
    let rows = state.offers.filter((o) => (!status || o.status === status) && (!merchantId || (merchantId === '*' ? o.merchant_id == null : o.merchant_id === merchantId)));
    if (search) rows = rows.filter((o) => `${o.label} ${o.raw_text ?? ''} ${o.code ?? ''}`.toLowerCase().includes(search.toLowerCase()));
    return structuredClone(rows).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },
  async saveOffer(id, patch) { Object.assign(state.offers.find((o) => o.id === id), patch); },
  async createOffer(row) {
    const fp = rowFp(row);
    if (state.offers.some((o) => o.merchant_id === row.merchant_id && o.fingerprint === fp)) throw new Error('An identical offer already exists for this store.');
    state.offers.push({ ...row, fingerprint: fp, id: String(nextId++), created_at: new Date().toISOString() });
  },

  async listFailures() { return structuredClone(state.failures.filter((f) => !f.resolved)); },
  async resolveFailure(id) { state.failures.find((f) => f.id === id).resolved = true; },

  /** Same shape as the ops_activity() function. Weekly figures are scaled to the window; the wave keeps sparklines from being flat. */
  async insights(days = 7) {
    const n = Math.min(Math.max(Math.round(days) || 7, 1), 90);
    const series = (weekly, phase) => Array.from({ length: n }, (_, k) => Math.max(0, Math.round((weekly / 7) * (1 + 0.35 * Math.sin(k * 1.3 + phase)))));
    const sum = (xs) => xs.reduce((a, b) => a + b, 0);
    const addDaily = (rows) => rows.reduce((acc, r) => acc.map((v, k) => v + r.daily[k]), Array(n).fill(0));

    const queries = [['iphone 17', 41, 1.2], ['samsung galaxy s25', 33, 0.9], ['sony wh-1000xm5', 27, 1.1], ['lg 55 inch oled', 19, 0.7], ['macbook air m4', 18, 1.4], ['dyson v15', 11, 0.8]]
      .map(([query, weekly, ratio], i) => ({ query, searches: sum(series(weekly, i)), previous: sum(series(weekly * ratio, i + 3)), daily: series(weekly, i) }))
      .filter((q) => q.searches > 0)
      .sort((a, b) => b.searches - a.searches);

    const merchants = [['amazon_in', 64, 1.1], ['flipkart', 41, 0.95], ['croma', 9, 0.6]]
      .map(([merchant_id, weekly, ratio], i) => ({ merchant_id, clicks: sum(series(weekly, i + 1)), previous: sum(series(weekly * ratio, i + 5)), daily: series(weekly, i + 1) }))
      .sort((a, b) => b.clicks - a.clicks);

    const searchDaily = addDaily(queries);
    const clickDaily = addDaily(merchants);
    return {
      days: n,
      searches: { current: sum(searchDaily), previous: sum(queries.map((q) => q.previous)), daily: searchDaily },
      clicks: { current: sum(clickDaily), previous: sum(merchants.map((m) => m.previous)), daily: clickDaily },
      queries,
      merchants,
    };
  },

  async refresh(merchantId) {
    if (!state.refreshed) {
      state.refreshed = true;
      MOCK_BANNERS.flipkart = [...MOCK_BANNERS.flipkart, '12% Instant Discount up to ₹2,000 on Axis Bank Credit Cards. Min purchase ₹12,000'];
    }
    let added = 0;
    for (const m of state.merchants.filter((x) => x.enabled && (!merchantId || x.id === merchantId))) {
      const r = await classifyBanners({ merchantId: m.id, banners: MOCK_BANNERS[m.id] ?? [], autoPublishMin: m.auto_publish_min });
      for (const row of r.rows) {
        if (state.offers.some((o) => o.merchant_id === m.id && o.fingerprint === row.fingerprint)) continue;
        state.offers.push({ ...row, id: String(nextId++), created_at: new Date().toISOString() });
        added++;
      }
      m.last_ok_at = new Date().toISOString();
      m.last_error = null;
    }
    return { added };
  },
};
