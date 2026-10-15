// Real backend: Supabase. Every call runs as the signed-in admin; row-level
// security in the database is what actually protects the data.
import { fingerprint } from '../vendor/core/index.js';

const SUPABASE_JS = 'https://esm.sh/@supabase/supabase-js@2.45.4';

export async function createSupabaseBackend({ supabaseUrl, supabaseAnonKey }) {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } });

  const ok = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  const count = async (table, build) => {
    const { count: n, error } = await build(sb.from(table).select('id', { count: 'exact', head: true }));
    if (error) throw new Error(error.message);
    return n ?? 0;
  };

  return {
    mode: 'supabase',

    async session() {
      const { data } = await sb.auth.getSession();
      const email = data.session?.user?.email;
      if (!email) return null;
      // Only admins can read the admins table, so seeing our own row proves we are one.
      const rows = ok(await sb.from('admins').select('email'));
      if (!rows.some((r) => r.email === email.toLowerCase())) return { email, notAdmin: true };
      return { email };
    },
    async signIn(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw new Error(error.message);
      return { signedIn: false, emailSent: true };
    },
    async signOut() { await sb.auth.signOut(); },

    async stats() {
      const [pending, live, expired, rejected, failures] = await Promise.all([
        count('offers', (q) => q.eq('status', 'pending')),
        count('offers', (q) => q.eq('status', 'live')),
        count('offers', (q) => q.eq('status', 'expired')),
        count('offers', (q) => q.eq('status', 'rejected')),
        count('parse_failures', (q) => q.eq('resolved', false)),
      ]);
      const errs = ok(await sb.from('merchants').select('id').not('last_error', 'is', null));
      return { pending, live, expired, rejected, failures, storesWithErrors: errs.length };
    },

    async listMerchants() { return ok(await sb.from('merchants').select('*').order('name')); },
    async saveMerchant(id, patch) { ok(await sb.from('merchants').update(patch).eq('id', id)); },
    async createMerchant(m) { ok(await sb.from('merchants').insert(m)); },

    async listOffers({ status, merchantId, search } = {}) {
      let q = sb.from('offers').select('*').order('created_at', { ascending: false }).limit(300);
      if (status) q = q.eq('status', status);
      if (merchantId === '*') q = q.is('merchant_id', null);
      else if (merchantId) q = q.eq('merchant_id', merchantId);
      if (search) q = q.ilike('label', `%${search.replace(/[%,]/g, ' ')}%`);
      return ok(await q);
    },
    async saveOffer(id, patch) { ok(await sb.from('offers').update(patch).eq('id', id)); },
    async createOffer(row) {
      const fp = fingerprint(row.merchant_id, {
        kind: row.kind, value: Number(row.value), maxCap: row.max_cap, minSpend: row.min_spend, issuer: row.issuer, network: row.network,
        cardType: row.card_type, paymentApp: row.payment_app, portal: row.portal, code: row.code, emiOnly: row.emi_only,
        requiresExchange: row.requires_exchange, rewardKind: row.reward_kind,
      });
      const { error } = await sb.from('offers').insert({ ...row, fingerprint: fp });
      if (error) throw new Error(error.code === '23505' ? 'An identical offer already exists for this store.' : error.message);
    },

    async listFailures() { return ok(await sb.from('parse_failures').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(200)); },
    async resolveFailure(id) { ok(await sb.from('parse_failures').update({ resolved: true }).eq('id', id)); },

    /** Totals, previous-period comparison and daily series. See migrations/20261015000000_ops_activity.sql. */
    async insights(days = 7) {
      return ok(await sb.rpc('ops_activity', { p_days: days }));
    },

    async refresh(merchantId) {
      const { data } = await sb.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/ingest${merchantId ? `?merchant=${encodeURIComponent(merchantId)}` : ''}`, {
        method: 'POST',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${data.session?.access_token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Refresh failed (${res.status})`);
      const failed = (body.results ?? []).filter((r) => r.error);
      if (failed.length) throw new Error(failed.map((f) => `${f.merchant}: ${f.error}`).join('; '));
      return { added: (body.results ?? []).reduce((n, r) => n + (r.regex ?? 0) + (r.llm ?? 0), 0) };
    },
  };
}
