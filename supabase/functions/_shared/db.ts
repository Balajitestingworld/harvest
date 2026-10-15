/**
 * Minimal PostgREST client using the service role. Edge functions only —
 * the service key never reaches the app or ops-web.
 */
const URL_ = Deno.env.get('SUPABASE_URL');
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

export const dbConfigured = !!(URL_ && KEY);

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...extra };
}

async function check(res: Response, what: string) {
  if (!res.ok) throw new Error(`${what} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

export const db = {
  async select<T = any>(table: string, query = ''): Promise<T[]> {
    const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, { headers: headers() });
    await check(res, `select ${table}`);
    return (await res.json()) as T[];
  },

  async insert(
    table: string,
    rows: unknown[],
    opts: { onConflict?: string; ignoreDuplicates?: boolean } = {},
  ): Promise<void> {
    if (!rows.length) return;
    const qs = opts.onConflict ? `?on_conflict=${opts.onConflict}` : '';
    const prefer = ['return=minimal', opts.ignoreDuplicates ? 'resolution=ignore-duplicates' : ''].filter(Boolean).join(',');
    const res = await fetch(`${URL_}/rest/v1/${table}${qs}`, {
      method: 'POST',
      headers: headers({ Prefer: prefer }),
      body: JSON.stringify(rows),
    });
    await check(res, `insert ${table}`);
  },

  async patch(table: string, filter: string, body: unknown): Promise<void> {
    const res = await fetch(`${URL_}/rest/v1/${table}?${filter}`, {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(body),
    });
    await check(res, `patch ${table}`);
  },

  async rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: headers(), body: JSON.stringify(args) });
    await check(res, `rpc ${fn}`);
    return (await res.json()) as T;
  },
};

/** Verify a signed-in user's access token and check the admin allowlist. */
export async function adminEmailFromToken(token: string): Promise<string | null> {
  if (!dbConfigured) return null;
  const res = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY!, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const email = String((await res.json())?.email ?? '').toLowerCase();
  if (!email) return null;
  const rows = await db.select<{ email: string }>('admins', `email=eq.${encodeURIComponent(email)}&select=email`);
  return rows.length ? email : null;
}
