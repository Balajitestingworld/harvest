import { MOCK_BANNERS, mockListing, MERCHANTS as DEMO_MERCHANTS } from './core/mock.ts';
import { db, dbConfigured } from './db.ts';
import type { Listing } from './core/types.ts';

/**
 * A merchant row from the `merchants` table (or the built-in demo list when no
 * database is configured). ops-web edits these; no redeploy needed.
 */
export interface Merchant {
  id: string;
  name: string;
  enabled: boolean;
  adapter: string;
  affiliate_tag: string | null;
  allowed_hosts: string[];
  cache_minutes: number;
  offer_page_url: string | null;
  auto_publish_min: number | null;
}

/**
 * One adapter per way of getting data. Official affiliate APIs first;
 * scraping only for offer banners that no API exposes.
 */
export interface Adapter {
  /** Best matching listing for the query, or null if the store has none. */
  search(query: string, m: Merchant, index: number): Promise<Listing | null>;
  /** Banner texts to feed the offer parser. */
  banners?(m: Merchant): Promise<string[]>;
}

const env = (k: string) => Deno.env.get(k) ?? '';

// ---------------------------------------------------------------------------
// Offer-banner scraping via a proxy service (ScrapingBee-compatible API).
// ---------------------------------------------------------------------------
export async function scrapeBanners(pageUrl: string): Promise<string[]> {
  const key = env('SCRAPER_API_KEY');
  if (!key) throw new Error('SCRAPER_API_KEY is not set');
  const api = env('SCRAPER_API_URL') || 'https://app.scrapingbee.com/api/v1/';
  const res = await fetch(`${api}?api_key=${key}&url=${encodeURIComponent(pageUrl)}&render_js=false&country_code=in`);
  if (!res.ok) throw new Error(`scraper returned ${res.status}`);
  return extractBanners(await res.text());
}

/** Pull short text fragments that look like bank offers out of raw HTML. */
export function extractBanners(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/li|\/div|\/p|\/span)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#8377;|&#x20b9;/gi, '₹')
    .replace(/&amp;/g, '&');
  const seen = new Set<string>();
  return text
    .split('\n')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 12 && s.length < 260)
    .filter((s) => /(%|₹|rs\.?)/i.test(s) && /\b(bank|card|cards|rupay|visa|mastercard|amex|upi|phonepe|paytm|cred|code|coupon|smartbuy|ishop)\b/i.test(s))
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
    .slice(0, 40);
}

const pageBanners = async (m: Merchant) => (m.offer_page_url ? scrapeBanners(m.offer_page_url) : []);

// ---------------------------------------------------------------------------
// Mock — works with zero setup. Deterministic demo prices + sample banners.
// ---------------------------------------------------------------------------
const mock: Adapter = {
  async search(query, m, index) {
    return mockListing(query, m.id, index);
  },
  async banners(m) {
    return MOCK_BANNERS[m.id] ?? [];
  },
};

// ---------------------------------------------------------------------------
// Flipkart — Flipkart Affiliate API (search endpoint, header auth).
// Needs FLIPKART_AFFILIATE_ID + FLIPKART_AFFILIATE_TOKEN. Check the current
// endpoint and terms in your affiliate dashboard before enabling.
// ---------------------------------------------------------------------------
const flipkart: Adapter = {
  async search(query, m) {
    const id = env('FLIPKART_AFFILIATE_ID');
    const token = env('FLIPKART_AFFILIATE_TOKEN');
    if (!id || !token) throw new Error('FLIPKART_AFFILIATE_ID / FLIPKART_AFFILIATE_TOKEN not set');
    const url = `https://affiliate-api.flipkart.net/affiliate/1.0/search.json?query=${encodeURIComponent(query)}&resultCount=5`;
    const res = await fetch(url, { headers: { 'Fk-Affiliate-Id': id, 'Fk-Affiliate-Token': token } });
    if (!res.ok) throw new Error(`flipkart ${res.status}`);
    const body = await res.json();
    for (const p of (body?.products ?? []) as any[]) {
      const b = p?.productBaseInfoV1;
      const price = Number(b?.flipkartSpecialPrice?.amount ?? b?.flipkartSellingPrice?.amount);
      if (!b || !Number.isFinite(price) || price <= 0) continue;
      const mrp = Number(b?.maximumRetailPrice?.amount);
      return {
        id: `${m.id}:${b.productId}`,
        merchantId: m.id,
        merchantName: m.name,
        title: String(b.title ?? query),
        price,
        mrp: Number.isFinite(mrp) && mrp > price ? mrp : null,
        shipping: 0,
        currency: 'INR',
        affiliateUrl: String(b.productUrl),
        imageUrl: b.imageUrls?.['400x400'] ?? null,
      };
    }
    return null;
  },
  banners: pageBanners,
};

// ---------------------------------------------------------------------------
// Amazon.in — Amazon Creators API (PA-API 5 is deprecated).
// Needs AMAZON_CREATORS_CLIENT_ID, AMAZON_CREATORS_CLIENT_SECRET and a partner
// tag (merchants.affiliate_tag or AMAZON_PARTNER_TAG). Per Amazon's docs, India
// is in the EU region: credential version 3.2, LwA token endpoint on
// api.amazon.co.uk. Override with AMAZON_TOKEN_URL if your credentials differ.
// Field names below follow Amazon's SearchItems reference; confirm against a
// real response once your account has access (see README → Merchant status).
// ---------------------------------------------------------------------------
let amazonToken: { value: string; expiresAt: number } | null = null;

async function amazonAccessToken(): Promise<string> {
  if (amazonToken && amazonToken.expiresAt > Date.now() + 60_000) return amazonToken.value;
  const id = env('AMAZON_CREATORS_CLIENT_ID');
  const secret = env('AMAZON_CREATORS_CLIENT_SECRET');
  if (!id || !secret) throw new Error('AMAZON_CREATORS_CLIENT_ID / AMAZON_CREATORS_CLIENT_SECRET not set');
  const res = await fetch(env('AMAZON_TOKEN_URL') || 'https://api.amazon.co.uk/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret, scope: 'creatorsapi::default' }),
  });
  if (!res.ok) throw new Error(`amazon token ${res.status}`);
  const j = await res.json();
  amazonToken = { value: String(j.access_token), expiresAt: Date.now() + Number(j.expires_in ?? 3600) * 1000 };
  return amazonToken.value;
}

const amazonIn: Adapter = {
  async search(query, m) {
    const tag = m.affiliate_tag || env('AMAZON_PARTNER_TAG');
    if (!tag) throw new Error('Amazon partner tag missing (set it on the merchant in ops-web)');
    const token = await amazonAccessToken();
    const res = await fetch('https://creatorsapi.amazon/catalog/v1/searchItems', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-marketplace': 'www.amazon.in' },
      body: JSON.stringify({
        keywords: query,
        partnerTag: tag,
        marketplace: 'www.amazon.in',
        itemCount: 3,
        resources: ['itemInfo.title', 'images.primary.medium', 'offersV2.listings.price'],
      }),
    });
    if (!res.ok) throw new Error(`amazon search ${res.status}`);
    const j = await res.json();
    for (const it of (j?.searchResult?.items ?? []) as any[]) {
      const listing = it?.offersV2?.listings?.[0];
      const price = Number(listing?.price?.money?.amount);
      if (!Number.isFinite(price) || price <= 0 || !it?.detailPageURL) continue;
      const was = Number(listing?.price?.savingBasis?.money?.amount);
      return {
        id: `${m.id}:${it.asin}`,
        merchantId: m.id,
        merchantName: m.name,
        title: String(it?.itemInfo?.title?.displayValue ?? query),
        price,
        mrp: Number.isFinite(was) && was > price ? was : null,
        shipping: 0,
        currency: 'INR',
        // detailPageURL already carries the partner tag.
        affiliateUrl: String(it.detailPageURL),
        imageUrl: it?.images?.primary?.medium?.url ?? null,
      };
    }
    return null;
  },
  banners: pageBanners,
};

export const ADAPTERS: Record<string, Adapter> = { mock, flipkart, amazon_in: amazonIn };

// ---------------------------------------------------------------------------
// Merchant list: from the database when configured, else the demo stores.
// Cached briefly; if the database blips, the last good list keeps search alive.
// ---------------------------------------------------------------------------
const DEMO: Merchant[] = DEMO_MERCHANTS.map((m) => ({
  id: m.id,
  name: m.name,
  enabled: true,
  adapter: 'mock',
  affiliate_tag: null,
  allowed_hosts: [],
  cache_minutes: 90,
  offer_page_url: null,
  auto_publish_min: null,
}));

let merchantCache: { at: number; rows: Merchant[] } | null = null;
const MERCHANT_TTL_MS = 60_000;

export async function loadMerchants(opts: { includeDisabled?: boolean; fresh?: boolean } = {}): Promise<Merchant[]> {
  if (!dbConfigured) return DEMO;
  if (opts.fresh || !merchantCache || Date.now() - merchantCache.at > MERCHANT_TTL_MS) {
    try {
      merchantCache = { at: Date.now(), rows: await db.select<Merchant>('merchants', 'select=*&order=name') };
    } catch (e) {
      if (!merchantCache) throw e;
      console.warn('merchants refresh failed, using last known list', e);
      merchantCache.at = Date.now();
    }
  }
  return opts.includeDisabled ? merchantCache.rows : merchantCache.rows.filter((m) => m.enabled);
}
