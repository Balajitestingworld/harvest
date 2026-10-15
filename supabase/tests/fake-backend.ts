/**
 * A tiny in-memory stand-in for Supabase's REST API (PostgREST + auth) and the
 * Anthropic API, installed over globalThis.fetch. It understands only the
 * query shapes the edge functions use: eq / neq / is.null / in / gte filters,
 * order, limit, on_conflict + ignore-duplicates, PATCH, and a few RPCs.
 */
export type Row = Record<string, any>;

export interface Backend {
  tables: Record<string, Row[]>;
  calls: { method: string; url: string }[];
  llmCalls: { system: string; user: string }[];
  llmReply: (user: string) => string;
  adminTokens: Record<string, string>; // access token → email
  rpcCalls: string[];
  restore: () => void;
}

const UNIQUE: Record<string, string[]> = {
  offers: ['merchant_id', 'fingerprint'],
  parse_failures: ['merchant_id', 'raw_text'],
};

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [col, expr] of params) {
    if (['select', 'order', 'limit', 'on_conflict'].includes(col)) continue;
    const [op, ...rest] = expr.split('.');
    const val = rest.join('.');
    const cell = row[col];
    if (op === 'eq') {
      if (String(cell) !== val) return false;
    } else if (op === 'neq') {
      if (String(cell) === val) return false;
    } else if (op === 'is') {
      if (val === 'null' ? cell != null : cell == null) return false;
    } else if (op === 'in') {
      const list = val.replace(/^\(|\)$/g, '').split(',');
      if (!list.includes(String(cell))) return false;
    } else if (op === 'gte') {
      if (!(String(cell) >= decodeURIComponent(val))) return false;
    } else {
      throw new Error(`fake backend: unsupported filter ${col}=${expr}`);
    }
  }
  return true;
}

export function installFakeBackend(supabaseUrl: string): Backend {
  const real = globalThis.fetch;
  const be: Backend = {
    tables: { merchants: [], offers: [], price_history: [], parse_failures: [], admins: [], search_events: [], click_events: [] },
    calls: [],
    llmCalls: [],
    llmReply: () => '{"not_an_offer": true}',
    adminTokens: {},
    rpcCalls: [],
    restore: () => {
      globalThis.fetch = real;
    },
  };
  let nextId = 1;

  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method ?? 'GET').toUpperCase();
    be.calls.push({ method, url: url.toString() });
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

    if (url.hostname === 'api.anthropic.com') {
      const body = JSON.parse(init.body);
      const user = body.messages[0].content as string;
      be.llmCalls.push({ system: body.system, user });
      return json({ content: [{ type: 'text', text: be.llmReply(user) }] });
    }

    if (url.origin !== supabaseUrl) return real(input, init);

    if (url.pathname === '/auth/v1/user') {
      const token = String(init.headers?.Authorization ?? '').replace(/^Bearer\s+/i, '');
      const email = be.adminTokens[token];
      return email ? json({ email }) : json({ error: 'bad token' }, 401);
    }

    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
    if (rpc) {
      be.rpcCalls.push(rpc[1]!);
      return json(0);
    }

    const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
    if (!m) return json({ error: 'not found' }, 404);
    const table = be.tables[m[1]!];
    if (!table) return json({ error: `no table ${m[1]}` }, 404);

    if (method === 'GET') {
      let rows = table.filter((r) => matches(r, url.searchParams));
      const order = url.searchParams.get('order');
      if (order) {
        const [col, dir] = order.split('.');
        rows = [...rows].sort((a, b) => (String(a[col!]) < String(b[col!]) ? -1 : 1) * (dir === 'desc' ? -1 : 1));
      }
      const limit = url.searchParams.get('limit');
      return json(limit ? rows.slice(0, Number(limit)) : rows);
    }

    if (method === 'POST') {
      const rows: Row[] = JSON.parse(init.body);
      const keys = UNIQUE[m[1]!];
      const ignore = String(init.headers?.Prefer ?? '').includes('ignore-duplicates');
      for (const r of rows) {
        if (keys && ignore && table.some((t) => keys.every((k) => t[k] === r[k]))) continue;
        table.push({ id: nextId++, created_at: new Date().toISOString(), seen_at: new Date().toISOString(), ...r });
      }
      return new Response(null, { status: 201 });
    }

    if (method === 'PATCH') {
      const patch = JSON.parse(init.body);
      for (const r of table.filter((r) => matches(r, url.searchParams))) Object.assign(r, patch);
      return new Response(null, { status: 204 });
    }

    return json({ error: 'unsupported' }, 405);
  }) as typeof fetch;

  return be;
}
