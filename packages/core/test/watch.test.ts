import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeAlert, evaluateWatch, formatINR, runWatchChecks, type SearchResponse, type WatchItem } from '../src/index.ts';

const res = (...prices: [string, number, number?][]): SearchResponse => ({
  query: 'q',
  cachedAt: new Date().toISOString(),
  listings: prices.map(([name, price, shipping], i) => ({
    id: String(i), merchantId: name, merchantName: name, title: 't', price, shipping: shipping ?? 0, currency: 'INR' as const, affiliateUrl: 'https://x',
  })),
  offers: [],
});
const item = (over: Partial<WatchItem> = {}): WatchItem => ({ id: '1', query: 'Sony WH-1000XM5', createdAt: new Date().toISOString(), ...over });

test('first check records the lowest price and does not alert', () => {
  const c = evaluateWatch(item(), res(['Amazon.in', 25000], ['Flipkart', 24500]))!;
  assert.equal(c.update.lastPrice, 24500);
  assert.equal(c.alert, null);
});

test('shipping counts toward the price', () => {
  const c = evaluateWatch(item(), res(['A', 1000, 99], ['B', 1050]))!;
  assert.equal(c.update.lastPrice, 1050);
});

test('alerts when a drop of 3% or more happens', () => {
  const c = evaluateWatch(item({ lastPrice: 25000 }), res(['Amazon.in', 24000]))!;
  assert.equal(c.alert?.reason, 'drop');
  assert.equal(c.alert?.price, 24000);
  assert.equal(evaluateWatch(item({ lastPrice: 25000 }), res(['Amazon.in', 24500]))!.alert, null);
});

test('target alert fires once, when the price crosses it', () => {
  const w = item({ targetPrice: 24000, lastPrice: 25000 });
  assert.equal(evaluateWatch(w, res(['A', 23900]))!.alert?.reason, 'target');
  // Already below target at the last check: no repeat alert for a small move.
  assert.equal(evaluateWatch({ ...w, lastPrice: 23900 }, res(['A', 23800]))!.alert, null);
});

test('no listings → nothing changes', () => {
  assert.equal(evaluateWatch(item({ lastPrice: 1 }), res()), null);
});

test('describeAlert wording', () => {
  const c = evaluateWatch(item({ lastPrice: 25000 }), res(['Amazon.in', 24000]))!;
  assert.equal(describeAlert('Sony', c.alert!, formatINR), 'Sony dropped to ₹24,000 at Amazon.in (was ₹25,000)');
});

test('runWatchChecks isolates failures and returns updated items', async () => {
  const items = [item({ id: 'a', query: 'ok', lastPrice: 1000 }), item({ id: 'b', query: 'bad', lastPrice: 500 })];
  const out = await runWatchChecks(items, async (q) => {
    if (q === 'bad') throw new Error('network');
    return res(['S', 900]);
  });
  assert.equal(out.items[0]!.lastPrice, 900);
  assert.equal(out.items[1]!.lastPrice, 500);
  assert.equal(out.alerts.length, 1);
  assert.equal(out.alerts[0]!.item.id, 'a');
});
