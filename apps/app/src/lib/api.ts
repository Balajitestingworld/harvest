/**
 * The ONLY network call the app makes for search (R-002, ACC-002):
 * GET /search?q=<text>. No card data, no user id, no device id.
 * With no Supabase env configured, it runs on built-in demo data.
 */
import { mockSearch, parseSearchResponse, type SearchResponse } from '@harvest/core';

const BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const USING_DEMO_DATA = !BASE || !ANON;

export async function search(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  if (USING_DEMO_DATA) {
    await new Promise((r) => setTimeout(r, 450)); // feel like a real request
    return mockSearch(query);
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}/functions/v1/search?q=${encodeURIComponent(query)}`, {
      headers: { apikey: ANON!, Authorization: `Bearer ${ANON}` },
      signal,
    });
  } catch (e: any) {
    if (signal?.aborted) throw e;
    // fetch only rejects when the network itself fails (offline, DNS, dropped connection).
    throw new Error("You're offline, or Harvest can't be reached. Check your connection and try again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Search failed (${res.status})`);
  }
  return parseSearchResponse(await res.json());
}

/** Route outbound clicks through the /go function for anonymous click counts. */
export function outboundUrl(merchantId: string, affiliateUrl: string): string {
  if (USING_DEMO_DATA) return affiliateUrl;
  return `${BASE}/functions/v1/go?m=${encodeURIComponent(merchantId)}&u=${encodeURIComponent(affiliateUrl)}`;
}
