import { BANKS, NETWORKS, PAYMENT_APPS, PORTALS } from './banks.ts';
import type { CardType, Network, Offer, RewardKind, StackGroup } from './types.ts';

/**
 * Regex parser (PRD: Offer Structuring). Turns Indian merchant banner text
 * into the structured Offer schema, e.g.
 *   "10% Instant Discount up to ₹1,500 on HDFC Bank Credit Cards. Min purchase ₹5,000"
 * Anything it can't read at all returns null (the pipeline then tries the LLM
 * and, failing that, queues it for a person). Every parse carries a confidence
 * score so ops can decide what to auto-publish and what to review.
 */

const MONEY = String.raw`(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)`;

const RE_PERCENT = /(?:^|[^\d.])(\d{1,3}(?:\.\d+)?)\s*%\s*(?:instant\s+)?(?:discount|off|cashback|savings?)?/i;
const RE_PERCENT_ALL = /(?:^|[^\d.])\d{1,3}(?:\.\d+)?\s*%/g;
const RE_UPTO_PERCENT = /up\s*to\s*\d{1,2}(?:\.\d+)?\s*%/i;
const RE_FLAT = new RegExp(String.raw`(?:flat\s*)?${MONEY}\s*(?:instant\s+)?(?:discount|off|cashback)`, 'i');
const RE_FLAT_ALL = new RegExp(String.raw`(?:flat\s*)?${MONEY}\s*(?:instant\s+)?(?:discount|off|cashback)`, 'gi');
const RE_CAP = new RegExp(
  String.raw`(?:up\s*to|upto|max(?:imum)?(?:\s+discount)?(?:\s+of)?|capped\s+at)\s*${MONEY}`,
  'i',
);
const RE_MIN = new RegExp(
  String.raw`(?:min(?:imum)?\.?\s*(?:order|purchase|transaction|txn|spend|cart)?\s*(?:value|amount)?\s*(?:of)?|(?:cart|order|bill)\s+value\s+(?:of\s+|above\s+|over\s+)?|on\s+(?:orders?|purchases?|transactions?)\s+(?:above|over|of)|above)\s*${MONEY}`,
  'i',
);
const RE_NOT_STACKABLE = /cannot\s+be\s+(?:combined|clubbed)|not\s+(?:valid|applicable)\s+with\s+(?:any\s+)?other/i;
const RE_EMI = /\bemi\b/i;
const RE_NON_EMI = /non[\s-]?emi|emi\s*(?:&|and|\/|or)\s*non[\s-]?emi|full\s+swipe/i;
const RE_EXCHANGE = /\bexchange\b/i;
const RE_NO_EXCHANGE = /(?:no|without|non)[\s-]+exchange/i;
const RE_POINTS = /reward\s*points?|\bpoints\b|neucoins?|\bpts\b|edge\s*miles/i;
const RE_CASHBACK = /cash[\s-]?back|%\s*back\b/i;
const RE_PARTIAL = /select(?:ed)?\s+(?:products?|items?|categories|brands|models|sellers?|cards?)|on\s+select\b|t\s*&\s*c|terms\s+apply|\*/i;
// "use code SAVE10", "coupon code: SAVE10", "coupon: SAVE10"
const RE_CODE = /(?:\b(?:coupon\s+)?code\b|\bcoupon\b)\s*[:\-]?\s*["'“]?([A-Za-z0-9]{4,16})["'”]?/gi;
const NOT_CODES = new Set(['APPLY', 'ENTER', 'USE', 'WITH', 'FROM', 'THIS', 'THAT', 'AVAILABLE', 'VALID', 'APPLICABLE', 'CARDS', 'CARD']);

const money = (s: string | undefined) => (s ? Number(s.replace(/,/g, '')) : NaN);

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findAlias<T extends { slug: string; aliases: string[] }>(text: string, list: T[]): T | null {
  // Longest alias first so "sbi card" wins over "sbi", "american express" over "amex".
  const all = list.flatMap((item) => item.aliases.map((a) => ({ item, a })));
  all.sort((x, y) => y.a.length - x.a.length);
  for (const { item, a } of all) {
    if (new RegExp(`\\b${escape(a)}\\b`, 'i').test(text)) return item;
  }
  return null;
}

function findCode(text: string): string | null {
  RE_CODE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_CODE.exec(text))) {
    const tok = m[1]!;
    // Real codes are typed in capitals and usually mix letters and digits.
    if (tok !== tok.toUpperCase() || !/[A-Z]/.test(tok) || NOT_CODES.has(tok)) continue;
    return tok;
  }
  return null;
}

/** Which stacking bucket an offer belongs to, from its conditions. */
export function stackGroupFor(o: {
  code?: string | null;
  portal?: string | null;
  paymentApp?: string | null;
  issuer?: string | null;
  network?: string | null;
}): StackGroup {
  if (o.code) return 'coupon';
  if (o.portal) return 'portal';
  if (o.paymentApp) return 'payment';
  if (o.issuer) return 'bank';
  if (o.network) return 'network';
  return 'merchant';
}

export interface ParsedOffer extends Omit<Offer, 'id' | 'merchantId'> {
  /** 0–1. How sure the parser is that the structured fields match the text. */
  confidence: number;
}

/** Count distinct discounts mentioned, ignoring "up to ₹X" which is a cap. */
function countDiscounts(t: string): number {
  const pct = t.match(RE_PERCENT_ALL)?.length ?? 0;
  let flat = 0;
  RE_FLAT_ALL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_FLAT_ALL.exec(t))) {
    const before = t.slice(Math.max(0, m.index - 14), m.index);
    if (!/(?:up\s*to|upto|max(?:imum)?(?:\s+of)?|capped\s+at)\s*$/i.test(before)) flat++;
  }
  return pct + flat;
}

export function parseOfferText(text: string): ParsedOffer | null {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return null;

  let kind: Offer['kind'];
  let value: number;
  const pct = t.match(RE_PERCENT);
  const flat = t.match(RE_FLAT);
  if (pct && (!flat || (pct.index ?? 0) <= (flat.index ?? 0))) {
    kind = 'percent';
    value = Number(pct[1]);
  } else if (flat) {
    kind = 'flat';
    value = money(flat[1]);
  } else {
    return null;
  }
  if (!Number.isFinite(value) || value <= 0) return null;
  if (kind === 'percent' && value > 100) return null;

  const capM = t.match(RE_CAP);
  const minM = t.match(RE_MIN);
  const maxCap = capM ? money(capM[1]) : null;
  const minSpend = minM ? money(minM[1]) : null;

  const portal = findAlias(t, PORTALS);
  let bank = findAlias(t, BANKS);
  if (!bank && portal) bank = BANKS.find((b) => b.slug === portal.issuer) ?? null;
  let network = findAlias(t, NETWORKS)?.slug ?? null;
  // "American Express" is both issuer and network.
  if (bank?.slug === 'amex') network = 'amex';

  // "Amazon Pay ICICI credit card" is a card, not the Amazon Pay app.
  let app = findAlias(t, PAYMENT_APPS)?.slug ?? null;
  if (app && (bank || network) && !/\bupi\b|wallet/i.test(t)) app = null;

  const code = findCode(t);

  const credit = /\bcredit\b/i.test(t);
  const debit = /\bdebit\b/i.test(t);
  const cardType: CardType | null = credit && !debit ? 'credit' : debit && !credit ? 'debit' : null;

  const stackGroup = stackGroupFor({ code, portal: portal?.slug ?? null, paymentApp: app, issuer: bank?.slug ?? null, network });

  const rewardKind: RewardKind = RE_CASHBACK.test(t) ? 'cashback' : RE_POINTS.test(t) ? 'points' : 'instant';
  const requiresExchange = RE_EXCHANGE.test(t) && !RE_NO_EXCHANGE.test(t);

  // ---- confidence ----
  let c = 0.35;
  const hasCondition = !!(bank || network || app || code);
  if (hasCondition) c += 0.2;
  if (kind === 'flat' || (Number.isFinite(maxCap) && maxCap != null)) c += 0.15;
  else c -= 0.05;
  if (minSpend != null && Number.isFinite(minSpend)) c += 0.1;
  if (/\bmin(?:imum)?\b/i.test(t) && minSpend == null) c -= 0.2;
  if (RE_UPTO_PERCENT.test(t)) c -= 0.3;
  if (countDiscounts(t) > 1) c -= 0.2;
  if (RE_PARTIAL.test(t)) c -= 0.15;
  if (t.length > 220) c -= 0.1;
  const confidence = Math.max(0, Math.min(1, Math.round(c * 100) / 100));

  return {
    issuer: bank?.slug ?? null,
    network: network as Network | null,
    cardType,
    tiers: null,
    paymentApp: app,
    portal: portal?.slug ?? null,
    code,
    kind,
    value,
    maxCap: Number.isFinite(maxCap) ? maxCap : null,
    minSpend: Number.isFinite(minSpend) ? minSpend : null,
    stackGroup,
    stackable: !RE_NOT_STACKABLE.test(t),
    emiOnly: RE_EMI.test(t) && !RE_NON_EMI.test(t),
    requiresExchange,
    rewardKind,
    label: t,
    source: 'regex',
    validFrom: null,
    validUntil: null,
    confidence,
  };
}

/** Convenience: parse and attach id + merchant, dropping anything unreadable. */
export function parseOffers(merchantId: string, banners: string[]): Offer[] {
  const out: Offer[] = [];
  banners.forEach((b, i) => {
    const p = parseOfferText(b);
    if (p) {
      const { confidence: _c, ...rest } = p;
      out.push({ ...rest, id: `${merchantId}:rx:${i}`, merchantId });
    }
  });
  return out;
}
