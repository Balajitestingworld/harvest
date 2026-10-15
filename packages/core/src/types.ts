/**
 * Shared data contract between the backend (Supabase edge function) and the
 * client (Expo app). The backend only ever sends GLOBAL data: listings and
 * every known offer for those merchants. It never sees the user's cards.
 * The client filters and computes locally (inverted privacy model).
 */

export type Network = 'visa' | 'mastercard' | 'rupay' | 'amex' | 'diners';
export type CardType = 'credit' | 'debit';

/** A card in the on-device vault. Metadata only — never a PAN, CVV or expiry. */
export interface VaultCard {
  id: string;
  /** Normalised issuer slug, e.g. "hdfc", "icici", "sbi". See banks.ts. */
  issuer: string;
  network: Network;
  type: CardType;
  /** Optional product/tier slug, e.g. "millennia", "regalia", "amazon-pay". */
  tier?: string;
  /** User-chosen label. Validated to contain no card numbers. */
  nickname?: string;
}

/**
 * Offers on the same payment can combine only across different groups.
 * Within a group, only the single best offer counts.
 *  - "bank":     issuer offers (HDFC 10% instant discount)
 *  - "network":  network offers (RuPay 5% off)
 *  - "merchant": card-agnostic store promos — always apply
 *  - "payment":  UPI / wallet offers (PhonePe, Paytm, Amazon Pay…)
 *  - "coupon":   promo codes the user types in at checkout
 *  - "portal":   bank shopping-portal rewards (SmartBuy, iShop…)
 */
export type StackGroup = 'bank' | 'network' | 'merchant' | 'payment' | 'coupon' | 'portal';

/** How the saving reaches the user. All are valued in rupees for comparison. */
export type RewardKind = 'instant' | 'cashback' | 'points';

export type OfferSource = 'api' | 'regex' | 'llm' | 'manual' | 'mock';

export interface Offer {
  id: string;
  /** Merchant this offer applies on; null = applies on every merchant. */
  merchantId: string | null;
  /** Conditions. A null/undefined condition means "any". */
  issuer?: string | null;
  network?: Network | null;
  cardType?: CardType | null;
  /** If set, the card's tier must be one of these. */
  tiers?: string[] | null;
  /** UPI / wallet app slug (see PAYMENT_APPS). Offer needs that app, not a card. */
  paymentApp?: string | null;
  /** Bank shopping portal slug the user must buy through (see PORTALS). */
  portal?: string | null;
  /** Promo code to enter at checkout. */
  code?: string | null;

  kind: 'percent' | 'flat';
  /** Percent as a whole number (10 = 10%) or flat rupees. */
  value: number;
  /** Maximum discount in rupees. null = uncapped. */
  maxCap?: number | null;
  /** Minimum order value in rupees. */
  minSpend?: number | null;

  stackGroup: StackGroup;
  /** If false, this offer cannot be combined with any other offer. */
  stackable: boolean;
  /** Valid only when paying via card EMI. Excluded from prices unless the user opts in. */
  emiOnly?: boolean;
  /** Needs the user to trade in an old device. Excluded unless the user opts in. */
  requiresExchange?: boolean;
  /** Defaults to 'instant'. Cashback/points arrive after purchase. */
  rewardKind?: RewardKind;

  /** Human-readable original text, shown in the breakdown. */
  label: string;
  /** Where the structured data came from (helps QA the parsers). */
  source: OfferSource;
  validFrom?: string | null;
  validUntil?: string | null;
}

/** Summary of what this product has cost on this store over time. */
export interface PriceStats {
  samples: number;
  /** Span in days covered by the samples. */
  days: number;
  low: number;
  high: number;
  median: number;
}

export interface Listing {
  id: string;
  merchantId: string;
  merchantName: string;
  title: string;
  /** Selling price in rupees, before any card offer. */
  price: number;
  /** The "was" price the store shows (MRP), if known. */
  mrp?: number | null;
  shipping: number;
  currency: 'INR';
  /** Outbound URL with affiliate tag already attached by the backend. */
  affiliateUrl: string;
  imageUrl?: string | null;
  /** Filled in by the backend from its anonymous price history. */
  priceStats?: PriceStats | null;
}

/** GET /search?q=… response. Contains no user context by construction. */
export interface SearchResponse {
  query: string;
  /** ISO timestamp of when this payload was built (cache time). */
  cachedAt: string;
  listings: Listing[];
  offers: Offer[];
}

export interface AppliedOffer {
  offer: Offer;
  discount: number;
}

export type PriceVerdict = 'lowest' | 'good' | 'typical' | 'high' | 'unknown';

export interface PriceCheck {
  verdict: PriceVerdict;
  /** Short sentence the UI can show as-is. */
  note: string;
  /** True when the "was" price looks inflated versus real history. */
  fakeSale: boolean;
}

export interface MatchedResult {
  listing: Listing;
  basePrice: number;
  effectivePrice: number;
  totalDiscount: number;
  /** The vault card that unlocks the best price, or null if none helps. */
  card: VaultCard | null;
  /** The UPI / wallet app that unlocks the best price, or null. */
  app: string | null;
  applied: AppliedOffer[];
  priceCheck: PriceCheck;
}
