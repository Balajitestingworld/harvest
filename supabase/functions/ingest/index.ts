/**
 * POST /functions/v1/ingest[?merchant=<id>]
 *
 * Reads each enabled store's offer banners, parses them, and files the result:
 *   confident + store allows it → live      (otherwise) → pending review
 *   unreadable → LLM (if configured) → pending, else → parse_failures
 * Then expires stale offers and prunes old price history.
 *
 * Who may call it:
 *   - a scheduler, with header  x-ingest-secret: $INGEST_SECRET
 *   - a signed-in admin from ops-web ("Refresh offers")
 */
import { ADAPTERS, loadMerchants, type Merchant } from '../_shared/adapters.ts';
import { adminEmailFromToken, db, dbConfigured } from '../_shared/db.ts';
import { corsHeaders, json } from '../_shared/http.ts';
import { callClaude, llmAvailable } from '../_shared/llm.ts';
import { classifyBanners } from '../_shared/core/server/ingest.ts';

async function authorized(req: Request): Promise<boolean> {
  const secret = Deno.env.get('INGEST_SECRET');
  if (secret && req.headers.get('x-ingest-secret') === secret) return true;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (bearer) return (await adminEmailFromToken(bearer)) != null;
  return false;
}

async function ingestMerchant(m: Merchant) {
  const adapter = ADAPTERS[m.adapter];
  if (!adapter?.banners) throw new Error(`adapter "${m.adapter}" cannot read offers`);
  const banners = await adapter.banners(m);
  const result = await classifyBanners({
    merchantId: m.id,
    banners,
    llm: llmAvailable ? callClaude : undefined,
    autoPublishMin: m.auto_publish_min,
  });

  // New meanings are inserted; ones we already have are left untouched, so a
  // rejection or an ops edit is never overwritten by the next crawl.
  await db.insert('offers', result.rows, { onConflict: 'merchant_id,fingerprint', ignoreDuplicates: true });
  const now = new Date().toISOString();
  if (result.seen.length) {
    const inList = `fingerprint=in.(${result.seen.join(',')})&merchant_id=eq.${m.id}`;
    await db.patch('offers', inList, { last_seen_at: now });
    // An offer that went stale but is back on the page returns to the review queue.
    await db.patch('offers', `${inList}&status=eq.expired&valid_until=is.null`, { status: 'pending' });
  }
  await db.insert(
    'parse_failures',
    result.failures.map((raw_text) => ({ merchant_id: m.id, raw_text })),
    { onConflict: 'merchant_id,raw_text', ignoreDuplicates: true },
  );
  await db.patch('merchants', `id=eq.${m.id}`, { last_ok_at: now, last_error: null, last_error_at: null });
  return { merchant: m.id, banners: banners.length, ...result.stats };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!dbConfigured) return json({ error: 'Database is not configured' }, 503);
  if (!(await authorized(req))) return json({ error: 'Not allowed' }, 401);

  const only = new URL(req.url).searchParams.get('merchant');
  const merchants = (await loadMerchants({ includeDisabled: !!only, fresh: true })).filter((m) => !only || m.id === only);
  if (only && !merchants.length) return json({ error: `No store "${only}"` }, 404);

  const results: unknown[] = [];
  for (const m of merchants) {
    try {
      results.push(await ingestMerchant(m));
    } catch (e) {
      const message = String((e as Error).message ?? e).slice(0, 300);
      await db
        .patch('merchants', `id=eq.${m.id}`, { last_error: message, last_error_at: new Date().toISOString() })
        .catch(() => {});
      results.push({ merchant: m.id, error: message });
    }
  }

  const expired = await db.rpc<number>('expire_stale_offers').catch(() => null);
  const pruned = await db.rpc<number>('prune_price_history').catch(() => null);
  return json({ results, expired, pruned });
});
