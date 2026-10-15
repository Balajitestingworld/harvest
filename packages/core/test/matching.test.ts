import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestCombination,
  isStale,
  matchListing,
  matchSearch,
  offerDiscount,
  type Listing,
  type Offer,
  type VaultCard,
} from '../src/index.ts';

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: 'l1',
  merchantId: 'amazon_in',
  merchantName: 'Amazon.in',
  title: 'Test item',
  price: 1000,
  shipping: 0,
  currency: 'INR',
  affiliateUrl: 'https://www.amazon.in/dp/X?tag=harvest-21',
  ...over,
});

const offer = (over: Partial<Offer>): Offer => ({
  id: Math.random().toString(36),
  merchantId: 'amazon_in',
  kind: 'percent',
  value: 10,
  stackGroup: 'bank',
  stackable: true,
  label: 'test',
  source: 'manual',
  ...over,
});

const hdfcVisa: VaultCard = { id: 'c1', issuer: 'hdfc', network: 'visa', type: 'credit' };
const iciciRupay: VaultCard = { id: 'c2', issuer: 'icici', network: 'rupay', type: 'credit' };

test('ACC-003: ₹1000 item, "10% off max ₹50" → ₹950', () => {
  const r = matchListing(listing(), [offer({ issuer: 'hdfc', maxCap: 50 })], [hdfcVisa]);
  assert.equal(r.effectivePrice, 950);
  assert.equal(r.totalDiscount, 50);
  assert.equal(r.card?.id, 'c1');
});

test('R-003: discount = MIN(base * pct, cap)', () => {
  assert.equal(offerDiscount(offer({ maxCap: 1500 }), 10000), 1000);
  assert.equal(offerDiscount(offer({ maxCap: 1500 }), 50000), 1500);
  assert.equal(offerDiscount(offer({ maxCap: null }), 50000), 5000);
});

test('minimum spend not met → no discount', () => {
  assert.equal(offerDiscount(offer({ minSpend: 5000 }), 4999), 0);
  assert.equal(offerDiscount(offer({ minSpend: 5000 }), 5000), 500);
});

test('flat offer never exceeds the order value', () => {
  assert.equal(offerDiscount(offer({ kind: 'flat', value: 2000 }), 1500), 1500);
});

test('ACC-004: Amex offer is hidden from a Visa-only vault', () => {
  const r = matchListing(listing(), [offer({ issuer: 'amex', network: 'amex' })], [hdfcVisa]);
  assert.equal(r.effectivePrice, 1000);
  assert.equal(r.applied.length, 0);
  assert.equal(r.card, null);
});

test('network, card type and tier conditions are all enforced', () => {
  const vault = [hdfcVisa];
  assert.equal(matchListing(listing(), [offer({ issuer: 'hdfc', network: 'mastercard' })], vault).totalDiscount, 0);
  assert.equal(matchListing(listing(), [offer({ issuer: 'hdfc', cardType: 'debit' })], vault).totalDiscount, 0);
  assert.equal(matchListing(listing(), [offer({ issuer: 'hdfc', tiers: ['infinia'] })], vault).totalDiscount, 0);
  const infinia = { ...hdfcVisa, tier: 'infinia' };
  assert.equal(matchListing(listing(), [offer({ issuer: 'hdfc', tiers: ['infinia'] })], [infinia]).totalDiscount, 100);
});

test('offers for another merchant are ignored', () => {
  const r = matchListing(listing(), [offer({ issuer: 'hdfc', merchantId: 'flipkart' })], [hdfcVisa]);
  assert.equal(r.totalDiscount, 0);
});

test('R-004: bank + network + merchant offers stack on one card', () => {
  const offers = [
    offer({ issuer: 'icici', value: 10 }), // ₹100
    offer({ network: 'rupay', stackGroup: 'network', kind: 'flat', value: 50 }), // ₹50
    offer({ stackGroup: 'merchant', kind: 'flat', value: 25 }), // ₹25, anyone
  ];
  const r = matchListing(listing(), offers, [iciciRupay]);
  assert.equal(r.totalDiscount, 175);
  assert.equal(r.applied.length, 3);
});

test('R-004: only the best offer within the same group counts', () => {
  const offers = [offer({ issuer: 'hdfc', value: 10 }), offer({ issuer: 'hdfc', value: 5 })];
  const r = matchListing(listing(), offers, [hdfcVisa]);
  assert.equal(r.totalDiscount, 100);
  assert.equal(r.applied.length, 1);
});

test('R-004: a non-stackable offer only wins if it beats the stacked combo', () => {
  const stack = [
    offer({ issuer: 'icici', value: 10 }), // 100
    offer({ network: 'rupay', stackGroup: 'network', kind: 'flat', value: 80 }), // 80
  ];
  const loner = offer({ issuer: 'icici', kind: 'flat', value: 150, stackable: false });
  assert.equal(bestCombination([...stack, loner], 1000).reduce((s, a) => s + a.discount, 0), 180);
  const bigLoner = offer({ issuer: 'icici', kind: 'flat', value: 250, stackable: false });
  const best = bestCombination([...stack, bigLoner], 1000);
  assert.equal(best.length, 1);
  assert.equal(best[0]!.discount, 250);
});

test('picks the card in the vault that saves the most', () => {
  const offers = [offer({ issuer: 'hdfc', value: 5 }), offer({ issuer: 'icici', value: 12 })];
  const r = matchListing(listing(), offers, [hdfcVisa, iciciRupay]);
  assert.equal(r.card?.id, 'c2');
  assert.equal(r.effectivePrice, 880);
});

test('card-agnostic offers apply even with an empty vault', () => {
  const r = matchListing(listing(), [offer({ stackGroup: 'merchant', kind: 'flat', value: 30 })], []);
  assert.equal(r.effectivePrice, 970);
  assert.equal(r.card, null);
});

test('EMI-only offers are excluded unless the user opts in', () => {
  const offers = [offer({ issuer: 'hdfc', emiOnly: true })];
  assert.equal(matchListing(listing(), offers, [hdfcVisa]).totalDiscount, 0);
  assert.equal(matchListing(listing(), offers, [hdfcVisa], { includeEmi: true }).totalDiscount, 100);
});

test('shipping is included in base and effective price', () => {
  const r = matchListing(listing({ shipping: 99 }), [offer({ issuer: 'hdfc' })], [hdfcVisa]);
  assert.equal(r.basePrice, 1099);
  assert.equal(r.effectivePrice, 999);
});

test('results sort by lowest effective price across merchants', () => {
  const res = matchSearch(
    {
      query: 'x',
      cachedAt: new Date().toISOString(),
      listings: [
        listing({ id: 'a', merchantId: 'amazon_in', price: 1000 }),
        listing({ id: 'f', merchantId: 'flipkart', merchantName: 'Flipkart', price: 1050 }),
      ],
      offers: [offer({ merchantId: 'flipkart', issuer: 'hdfc', value: 10 })],
    },
    [hdfcVisa],
  );
  assert.deepEqual(res.map((r) => r.listing.id), ['f', 'a']);
  assert.equal(res[0]!.effectivePrice, 945);
});

test('R-005: data older than 2 hours is stale', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  assert.equal(isStale('2026-10-14T10:30:00Z', now), false);
  assert.equal(isStale('2026-10-14T09:59:00Z', now), true);
  assert.equal(isStale('garbage', now), true);
});
