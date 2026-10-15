import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  containsPan,
  explain,
  formatINR,
  luhnValid,
  matchSearch,
  mockSearch,
  parseOfferText,
  parseSearchResponse,
} from '../src/index.ts';

// ---------- PAN guard (R-001) ----------

test('R-001: rejects 16-digit card numbers in any common format', () => {
  for (const s of ['4111111111111111', '4111 1111 1111 1111', '4111-1111-1111-1111', 'my card 5500 0000 0000 0004 ok']) {
    assert.equal(containsPan(s), true, s);
  }
});

test('R-001: rejects 15-digit Amex and 19-digit RuPay-length numbers', () => {
  assert.equal(containsPan('3782 822463 10005'), true);
  assert.equal(containsPan('6522 1234 5678 9012 345'), true);
});

test('R-001: allows normal nicknames and short numbers', () => {
  for (const s of ['Regalia Gold', 'Amazon Pay ICICI', 'ends 4242', 'Card #2', '', undefined]) {
    assert.equal(containsPan(s), false, String(s));
  }
});

test('Luhn helper', () => {
  assert.equal(luhnValid('4111 1111 1111 1111'), true);
  assert.equal(luhnValid('4111 1111 1111 1112'), false);
});

// ---------- Offer parser ----------

test('parses a classic HDFC instant-discount banner', () => {
  const o = parseOfferText('10% Instant Discount up to ₹1,500 on HDFC Bank Credit Cards. Min purchase value ₹5,000');
  assert.ok(o);
  assert.equal(o.kind, 'percent');
  assert.equal(o.value, 10);
  assert.equal(o.maxCap, 1500);
  assert.equal(o.minSpend, 5000);
  assert.equal(o.issuer, 'hdfc');
  assert.equal(o.cardType, 'credit');
  assert.equal(o.stackGroup, 'bank');
  assert.equal(o.emiOnly, false);
});

test('parses flat offers with Rs. notation and "above"', () => {
  const o = parseOfferText('Flat Rs. 750 off on ICICI Bank Credit Cards on orders above Rs 10,000');
  assert.ok(o);
  assert.equal(o.kind, 'flat');
  assert.equal(o.value, 750);
  assert.equal(o.minSpend, 10000);
  assert.equal(o.issuer, 'icici');
});

test('detects EMI-only vs EMI & non-EMI', () => {
  assert.equal(parseOfferText('5% off up to ₹1,000 on SBI Credit Card EMI transactions')?.emiOnly, true);
  assert.equal(parseOfferText('5% off up to ₹1,000 on SBI Credit Card EMI & Non-EMI')?.emiOnly, false);
});

test('"SBI Card" matches issuer sbi; network-only offers go to the network group', () => {
  assert.equal(parseOfferText('5% cashback on SBI Card, max ₹500')?.issuer, 'sbi');
  const rupay = parseOfferText('Flat ₹500 off on RuPay credit cards on purchases above ₹3,000');
  assert.equal(rupay?.issuer, null);
  assert.equal(rupay?.network, 'rupay');
  assert.equal(rupay?.stackGroup, 'network');
});

test('credit AND debit → no card-type restriction; American Express → issuer + network', () => {
  assert.equal(parseOfferText('7.5% off up to ₹3,000 on HDFC Bank Credit and Debit Cards')?.cardType, null);
  const amex = parseOfferText('10% off up to ₹2,000 on American Express Cards');
  assert.equal(amex?.issuer, 'amex');
  assert.equal(amex?.network, 'amex');
});

test('"cannot be combined" marks the offer non-stackable', () => {
  assert.equal(parseOfferText('₹1,000 off on Kotak Credit Cards. Cannot be combined with other offers')?.stackable, false);
});

test('returns null for banners with no readable discount', () => {
  assert.equal(parseOfferText('No cost EMI available on select cards'), null);
  assert.equal(parseOfferText(''), null);
});

// ---------- Formatting ----------

test('formatINR uses Indian grouping', () => {
  assert.equal(formatINR(999), '₹999');
  assert.equal(formatINR(1500), '₹1,500');
  assert.equal(formatINR(123456.5), '₹1,23,456.50');
  assert.equal(formatINR(10000000), '₹1,00,00,000');
});

// ---------- End to end with mock payload ----------

test('mock payload round-trips through validation and matching', () => {
  const payload = parseSearchResponse(JSON.parse(JSON.stringify(mockSearch('iPhone 17'))));
  assert.equal(payload.listings.length, 3);
  assert.ok(payload.offers.length >= 6);
  const results = matchSearch(payload, [{ id: 'c', issuer: 'hdfc', network: 'visa', type: 'credit' }]);
  assert.equal(results.length, 3);
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1]!.effectivePrice <= results[i]!.effectivePrice);
  }
  assert.match(explain(results[0]!), /₹/);
});

test('validation drops malformed listings instead of throwing', () => {
  const p = parseSearchResponse({ listings: [{ id: 'x' }, null], offers: [{ id: 'o', kind: 'bogus' }] });
  assert.equal(p.listings.length, 0);
  assert.equal(p.offers.length, 0);
});
