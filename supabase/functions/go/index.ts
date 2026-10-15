/**
 * GET /functions/v1/go?m=<merchantId>&u=<affiliateUrl>
 *
 * Affiliate redirect. Counts the click anonymously (merchant id only) and
 * 302s to the merchant. Only hosts listed on an enabled merchant (ops-web) are
 * allowed, so this can't be abused as an open redirect.
 */
import { loadMerchants } from '../_shared/adapters.ts';
import { corsHeaders, json } from '../_shared/http.ts';
import { logClick } from '../_shared/telemetry.ts';

/** Used only when the database can't be reached at all. */
const FALLBACK_HOSTS = ['amazon.in', 'www.amazon.in', 'amzn.to', 'flipkart.com', 'www.flipkart.com', 'dl.flipkart.com', 'croma.com', 'www.croma.com'];

async function allowedHosts(): Promise<Set<string>> {
  try {
    const hosts = (await loadMerchants()).flatMap((m) => m.allowed_hosts ?? []);
    // Demo mode (no database) has no host lists, so use the built-in set.
    return new Set(hosts.length ? hosts : FALLBACK_HOSTS);
  } catch {
    return new Set(FALLBACK_HOSTS);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const params = new URL(req.url).searchParams;
  const merchant = (params.get('m') ?? 'unknown').slice(0, 40);
  let target: URL;
  try {
    target = new URL(params.get('u') ?? '');
  } catch {
    return json({ error: 'Bad url' }, 400);
  }
  if (target.protocol !== 'https:' || !(await allowedHosts()).has(target.hostname)) {
    return json({ error: 'Merchant not allowed' }, 400);
  }
  logClick(merchant);
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: target.toString() } });
});
