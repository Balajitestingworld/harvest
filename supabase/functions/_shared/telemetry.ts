/**
 * Anonymous telemetry (PRD: Telemetry). Writes ONLY the query string or the
 * merchant id plus a timestamp. No IP, no user agent, no device id, no user id.
 * Uses PostgREST directly so the function has no npm dependencies.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

async function insert(table: string, row: Record<string, unknown>) {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
  } catch {
    // Telemetry must never break search.
  }
}

export const logSearch = (query: string, resultCount: number, cacheHit: boolean) =>
  insert('search_events', { query: query.slice(0, 120).toLowerCase(), result_count: resultCount, cache_hit: cacheHit });

export const logClick = (merchantId: string) => insert('click_events', { merchant_id: merchantId });
