/**
 * Parser corpus. These are representative banner phrasings of the kind Indian
 * stores and banks use. They were written from knowledge of common wording,
 * NOT captured from live pages. Replace/extend them with real banners from
 * your stores (use `npm run parse -- banners.txt`) — every banner that parses
 * wrong becomes a new row here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOfferText } from '../src/index.ts';

type Expect = Record<string, unknown>;
const CASES: [string, Expect | null][] = [
  ['Get 10% instant discount up to ₹1,000 on HDFC Bank Credit Card EMI transactions on orders of ₹10,000 and above',
    { kind: 'percent', value: 10, maxCap: 1000, issuer: 'hdfc', cardType: 'credit', emiOnly: true, minSpend: 10000 }],
  ['5% Unlimited Cashback on Axis Bank Buzz Credit Card',
    { kind: 'percent', value: 5, issuer: 'axis', cardType: 'credit', rewardKind: 'cashback', maxCap: null }],
  ['Flat 7.5% Instant Discount up to Rs 1,500 on ICICI Bank Credit Card Transactions. Minimum purchase value Rs 7,500 (T&C apply)',
    { value: 7.5, maxCap: 1500, minSpend: 7500, issuer: 'icici' }],
  ['Flat ₹1,250 Instant Discount on SBI Credit Cards (Non-EMI transactions) on a minimum purchase of ₹25,000',
    { kind: 'flat', value: 1250, issuer: 'sbi', emiOnly: false, minSpend: 25000 }],
  ['10% Instant Discount on Kotak Mahindra Bank Debit Cards, up to ₹750',
    { value: 10, maxCap: 750, issuer: 'kotak', cardType: 'debit' }],
  ['Extra ₹500 off with RuPay Credit Card on UPI',
    { kind: 'flat', value: 500, network: 'rupay', cardType: 'credit', stackGroup: 'network' }],
  ['Save 15% with American Express Cards. Max discount ₹3,000, min spend ₹20,000',
    { value: 15, maxCap: 3000, minSpend: 20000, issuer: 'amex', network: 'amex' }],
  ['Get 5% back as Amazon Pay balance with Amazon Pay ICICI credit card',
    { value: 5, issuer: 'icici', paymentApp: null, rewardKind: 'cashback' }],
  ['Pay with PhonePe UPI & get flat ₹100 cashback on orders above ₹1,500',
    { kind: 'flat', value: 100, paymentApp: 'phonepe', minSpend: 1500, stackGroup: 'payment', rewardKind: 'cashback' }],
  ['Paytm Wallet: Flat 10% cashback up to ₹200 on min. order ₹999',
    { value: 10, maxCap: 200, minSpend: 999, paymentApp: 'paytm' }],
  ['Use coupon code SAVE500 to get ₹500 off on orders above ₹5,000',
    { kind: 'flat', value: 500, code: 'SAVE500', minSpend: 5000, stackGroup: 'coupon' }],
  ['Apply code BIGSAVE for extra 5% off, up to ₹300',
    { value: 5, maxCap: 300, code: 'BIGSAVE' }],
  ['No cost EMI on HDFC Bank Credit Cards', null],
  ['Flat ₹2,000 off on HDFC Bank Credit Card EMI. Cannot be clubbed with other offers',
    { value: 2000, emiOnly: true, stackable: false }],
  ['Get up to ₹10,000 off on exchange of your old phone',
    { kind: 'flat', value: 10000, requiresExchange: true }],
  ['Earn 5X reward points on HDFC SmartBuy', null],
  ['10X Reward Points on Axis Bank Credit Cards via Edge Rewards', null],
  ['Bank Offer: 5% Instant Discount up to ₹750 on Yes Bank Credit Cards', { issuer: 'yes', maxCap: 750 }],
  ['10% off on IDFC FIRST Bank Credit Cards, max ₹1,000', { issuer: 'idfc', maxCap: 1000 }],
  ['Flat ₹300 off on RBL Bank Credit Card. Min. spend ₹3,000', { issuer: 'rbl', value: 300, minSpend: 3000 }],
  ['Get ₹150 cashback on your first UPI payment using BHIM app', { value: 150, paymentApp: 'bhim' }],
  ['Extra 10% off on Visa Signature Credit Cards up to ₹2,000', { network: 'visa', cardType: 'credit', maxCap: 2000 }],
  ['3% instant discount on Mastercard debit cards (min ₹10,000)', { network: 'mastercard', cardType: 'debit', minSpend: 10000 }],
  ['Flat 100% cashback up to ₹100 on first order', { kind: 'percent', value: 100, maxCap: 100 }],
  ['₹500 off on orders above ₹2,999 with code WELCOME500', { value: 500, minSpend: 2999, code: 'WELCOME500' }],
  ['Get an additional 5% off with HDFC Bank Credit Cards on Smartphones', { value: 5, issuer: 'hdfc', maxCap: null }],
  ['Pay with Amazon Pay UPI and get 2% back up to ₹100', { value: 2, maxCap: 100, paymentApp: 'amazonpay', rewardKind: 'cashback' }],
  ['Instant ₹1,500 discount on Federal Bank Credit Cards on cart value of ₹15,000', { value: 1500, issuer: 'federal', minSpend: 15000 }],
  ['Valid on Visa Infinite cards only. Get 10% off up to ₹5,000', { value: 10, maxCap: 5000, network: 'visa' }],
  ['Get 5% off with HDFC SmartBuy on HDFC Bank Credit Cards, up to ₹1,000',
    { portal: 'smartbuy', issuer: 'hdfc', stackGroup: 'portal', maxCap: 1000 }],
  ['Free delivery on orders above ₹499', null],
  ['', null],
];

for (const [text, expected] of CASES) {
  test(`corpus: ${text.slice(0, 70) || '(empty)'}`, () => {
    const got = parseOfferText(text);
    if (expected === null) return assert.equal(got, null);
    assert.ok(got, 'should parse');
    for (const [k, v] of Object.entries(expected)) {
      assert.deepEqual((got as any)[k], v, `${k}: got ${JSON.stringify((got as any)[k])}, want ${JSON.stringify(v)}`);
    }
  });
}
