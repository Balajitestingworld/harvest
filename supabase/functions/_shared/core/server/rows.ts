import type { CardType, Network, Offer, OfferSource, RewardKind, StackGroup } from '../types.ts';
import type { ParsedOffer } from '../offer-parser.ts';

/** Offer lifecycle. Only 'live' rows are ever sent to the app. */
export type OfferStatus = 'pending' | 'live' | 'rejected' | 'expired';

/** The `offers` table row, as PostgREST returns / accepts it. */
export interface OfferRow {
  id?: string;
  merchant_id: string | null;
  status: OfferStatus;
  source: OfferSource;
  kind: 'percent' | 'flat';
  value: number;
  max_cap: number | null;
  min_spend: number | null;
  issuer: string | null;
  network: string | null;
  card_type: string | null;
  tiers: string[] | null;
  payment_app: string | null;
  portal: string | null;
  code: string | null;
  stack_group: StackGroup;
  stackable: boolean;
  emi_only: boolean;
  requires_exchange: boolean;
  reward_kind: RewardKind;
  label: string;
  raw_text: string | null;
  confidence: number | null;
  valid_from: string | null;
  valid_until: string | null;
  fingerprint: string | null;
  last_seen_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
}

const num = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function rowToOffer(r: OfferRow): Offer {
  return {
    id: String(r.id),
    merchantId: r.merchant_id,
    issuer: r.issuer,
    network: (r.network as Network | null) ?? null,
    cardType: (r.card_type as CardType | null) ?? null,
    tiers: r.tiers && r.tiers.length ? r.tiers : null,
    paymentApp: r.payment_app,
    portal: r.portal,
    code: r.code,
    kind: r.kind,
    value: Number(r.value),
    maxCap: num(r.max_cap),
    minSpend: num(r.min_spend),
    stackGroup: r.stack_group,
    stackable: !!r.stackable,
    emiOnly: !!r.emi_only,
    requiresExchange: !!r.requires_exchange,
    rewardKind: r.reward_kind ?? 'instant',
    label: r.label,
    source: r.source,
    validFrom: r.valid_from,
    validUntil: r.valid_until,
  };
}

/** Two independent 32-bit FNV-1a hashes joined: plenty for de-duplication. */
function hash(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0xdeadbeef;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/**
 * Stable identity of an offer's *meaning* for one store, so a banner seen on
 * every crawl maps to one row, and a rejected row stays rejected.
 */
export function fingerprint(merchantId: string | null, p: Omit<ParsedOffer, 'confidence' | 'label' | 'source'> & { label?: string }): string {
  return hash(
    [
      merchantId ?? '*',
      p.kind,
      p.value,
      p.maxCap ?? '',
      p.minSpend ?? '',
      p.issuer ?? '',
      p.network ?? '',
      p.cardType ?? '',
      p.paymentApp ?? '',
      p.portal ?? '',
      p.code ?? '',
      p.emiOnly ? 'emi' : '',
      p.requiresExchange ? 'xchg' : '',
      p.rewardKind ?? 'instant',
    ].join('|'),
  );
}

export function parsedToRow(
  merchantId: string | null,
  p: ParsedOffer,
  extra: { status: OfferStatus; rawText: string | null; source?: OfferSource },
): OfferRow {
  return {
    merchant_id: merchantId,
    status: extra.status,
    source: extra.source ?? p.source,
    kind: p.kind,
    value: p.value,
    max_cap: p.maxCap ?? null,
    min_spend: p.minSpend ?? null,
    issuer: p.issuer ?? null,
    network: p.network ?? null,
    card_type: p.cardType ?? null,
    tiers: p.tiers && p.tiers.length ? p.tiers : null,
    payment_app: p.paymentApp ?? null,
    portal: p.portal ?? null,
    code: p.code ?? null,
    stack_group: p.stackGroup,
    stackable: p.stackable,
    emi_only: !!p.emiOnly,
    requires_exchange: !!p.requiresExchange,
    reward_kind: p.rewardKind ?? 'instant',
    label: p.label,
    raw_text: extra.rawText,
    confidence: p.confidence,
    valid_from: p.validFrom ?? null,
    valid_until: p.validUntil ?? null,
    fingerprint: fingerprint(merchantId, p),
  };
}

/** Cache / history key for a search: case, spacing and stray punctuation don't matter. */
export function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/[^\p{L}\p{N}\s.+-]/gu, ' ').replace(/\s+/g, ' ').trim();
}
