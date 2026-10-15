import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkPrice,
  isLive,
  matchListing,
  matchSearch,
  mockSearch,
  parseOfferText,
  summarizePrices,
  type Listing,
  type Offer,
  type VaultCard,
} from '../src/index.ts';

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: 'l1',
  merchantId: 'amazon_in',
  merchantName: 'Amazon.in',
  title: 'Item',
  price: 10000,
  shipping: 0,
  currency: 'INR',
  affiliateUrl: 'https://www.amazon.in/x',
  ...over,
});
const offer = (over: Partial<Offer>): Offer => ({
  id: Math.random().toString(36),
  merchantId: 'amazon_in',
  kind: 'percent',
  value: 10,
  stackGroup: 'bank',
  stackable: true,
  label: 't',
  source: 'manual',
  ...over,
});
const hdfc: VaultCard = { id: 'c1', issuer: 'hdfc', network: 'visa', type: 'credit' };

// ---------- Phase D ----------

test('UPI app offers apply only when the user has that app', () => {
  const o = offer({ paymentApp: 'phonepe', stackGroup: 'payment', kind: 'flat', value: 75 });
  assert.equal(matchListing(listing(), [o], [hdfc]).totalDiscount, 0);
  const r = matchListing(listing(), [o], [], { paymentApps: ['phonepe'] });
  assert.equal(r.totalDiscount, 75);
  assert.equal(r.app, 'phonepe');
  assert.equal(r.card, null);
});

test('a card offer is never unlocked by an app, and an app offer never by a card', () => {
  const cardOffer = offer({ issuer: 'hdfc', value: 10 });
  const appOffer = offer({ paymentApp: 'cred', stackGroup: 'payment', value: 3 });
  const r = matchListing(listing(), [cardOffer, appOffer], [hdfc], { paymentApps: ['cred'] });
  // 10% via card (1000) beats 3% via app (300); they do not add up.
  assert.equal(r.totalDiscount, 1000);
  assert.equal(r.card?.id, 'c1');
  assert.equal(r.app, null);
});

test('coupons stack with a card offer', () => {
  const o = [
    offer({ issuer: 'hdfc', value: 10 }),
    offer({ code: 'FLIP200', stackGroup: 'coupon', kind: 'flat', value: 200 }),
  ];
  const r = matchListing(listing(), o, [hdfc]);
  assert.equal(r.totalDiscount, 1200);
  assert.equal(r.applied.length, 2);
});

test('exchange offers are hidden unless the user opts in', () => {
  const o = offer({ stackGroup: 'merchant', kind: 'flat', value: 5000, requiresExchange: true });
  assert.equal(matchListing(listing(), [o], []).totalDiscount, 0);
  assert.equal(matchListing(listing(), [o], [], { includeExchange: true }).totalDiscount, 5000);
});

test('expired and not-yet-started offers are ignored', () => {
  const now = new Date('2026-10-14T00:00:00Z');
  assert.equal(isLive(offer({ validUntil: '2026-10-13T00:00:00Z' }), now), false);
  assert.equal(isLive(offer({ validFrom: '2026-10-15T00:00:00Z' }), now), false);
  assert.equal(isLive(offer({ validFrom: '2026-10-01T00:00:00Z', validUntil: '2026-10-31T00:00:00Z' }), now), true);
  const o = offer({ issuer: 'hdfc', validUntil: '2026-10-13T00:00:00Z' });
  assert.equal(matchListing(listing(), [o], [hdfc], { now }).totalDiscount, 0);
});

test('parser: UPI app, code, portal, exchange and reward kind', () => {
  const upi = parseOfferText('Flat ₹75 cashback on UPI payments with PhonePe. Min order ₹1,000')!;
  assert.equal(upi.paymentApp, 'phonepe');
  assert.equal(upi.stackGroup, 'payment');
  assert.equal(upi.rewardKind, 'cashback');
  assert.equal(upi.minSpend, 1000);

  const code = parseOfferText('Use code FLIP200 for flat ₹200 off on orders above ₹4,000')!;
  assert.equal(code.code, 'FLIP200');
  assert.equal(code.stackGroup, 'coupon');

  const portal = parseOfferText('5% reward points up to ₹500 via HDFC SmartBuy on HDFC Bank Credit Cards. Min order ₹5,000')!;
  assert.equal(portal.portal, 'smartbuy');
  assert.equal(portal.issuer, 'hdfc');
  assert.equal(portal.stackGroup, 'portal');
  assert.equal(portal.rewardKind, 'points');

  const xchg = parseOfferText('Get ₹5,000 off with exchange of your old smartphone. Min order ₹20,000')!;
  assert.equal(xchg.requiresExchange, true);
});

test('parser: "Amazon Pay ICICI credit card" is a card offer, not the Amazon Pay app', () => {
  const o = parseOfferText('5% back up to ₹500 with Amazon Pay ICICI Bank Credit Card')!;
  assert.equal(o.issuer, 'icici');
  assert.equal(o.paymentApp, null);
});

test('parser: ordinary words are not mistaken for promo codes', () => {
  assert.equal(parseOfferText('10% off up to ₹500 on HDFC Bank Credit Cards, apply code at checkout')?.code, null);
});

test('confidence: clear offers score high, vague ones low', () => {
  const clear = parseOfferText('10% Instant Discount up to ₹1,500 on HDFC Bank Credit Cards. Min purchase value ₹5,000')!;
  const vague = parseOfferText('Up to 10% off on select products with HDFC Bank cards*')!;
  const multi = parseOfferText('Get 10% off and an extra 5% cashback and flat ₹200 off on ICICI cards')!;
  assert.ok(clear.confidence >= 0.75, String(clear.confidence));
  assert.ok(vague.confidence <= 0.3, String(vague.confidence));
  assert.ok(multi.confidence < clear.confidence);
});

test('demo payload now includes every offer type, and they all parse', () => {
  const p = mockSearch('Sony headphones');
  assert.ok(p.offers.some((o) => o.paymentApp === 'phonepe'));
  assert.ok(p.offers.some((o) => o.code === 'FLIP200'));
  assert.ok(p.offers.some((o) => o.portal === 'smartbuy'));
  assert.ok(p.offers.some((o) => o.requiresExchange));
  const res = matchSearch(p, [hdfc], { paymentApps: ['phonepe', 'cred'] });
  assert.equal(res.length, 3);
});

// ---------- Phase E ----------

const daysAgo = (n: number, now: Date) => new Date(now.getTime() - n * 86400000).toISOString();

test('summarizePrices: median, range, span; ignores rows older than 90 days', () => {
  const now = new Date('2026-10-14T00:00:00Z');
  const rows = [10, 20, 30, 40, 50].map((d, i) => ({ price: 1000 + i * 100, seenAt: daysAgo(d, now) }));
  rows.push({ price: 1, seenAt: daysAgo(200, now) });
  const s = summarizePrices(rows, now)!;
  assert.equal(s.samples, 5);
  assert.equal(s.low, 1000);
  assert.equal(s.high, 1400);
  assert.equal(s.median, 1200);
  assert.equal(s.days, 50);
  assert.equal(summarizePrices([], now), null);
});

test('checkPrice: needs enough history before judging', () => {
  assert.equal(checkPrice(listing()).verdict, 'unknown');
  assert.equal(checkPrice(listing({ priceStats: { samples: 3, days: 30, low: 1, high: 2, median: 1 } })).verdict, 'unknown');
});

test('checkPrice verdicts', () => {
  const stats = { samples: 20, days: 60, low: 9000, high: 11500, median: 10500 };
  assert.equal(checkPrice(listing({ price: 8900, priceStats: stats })).verdict, 'lowest');
  assert.equal(checkPrice(listing({ price: 9900, priceStats: stats })).verdict, 'good');
  assert.equal(checkPrice(listing({ price: 10500, priceStats: stats })).verdict, 'typical');
  assert.equal(checkPrice(listing({ price: 11900, priceStats: stats })).verdict, 'high');
});

test('checkPrice: flags a crossed-out price the store has not charged', () => {
  const stats = { samples: 20, days: 60, low: 9500, high: 10600, median: 10000 };
  const c = checkPrice(listing({ price: 10000, mrp: 15000, priceStats: stats }));
  assert.equal(c.fakeSale, true);
  assert.match(c.note, /isn't a new drop/);
  // MRP that was really charged recently is fine.
  const ok = checkPrice(listing({ price: 10000, mrp: 15000, priceStats: { ...stats, high: 14800 } }));
  assert.equal(ok.fakeSale, false);
  // Small markdowns are not flagged.
  assert.equal(checkPrice(listing({ price: 10000, mrp: 10800, priceStats: stats })).fakeSale, false);
});
