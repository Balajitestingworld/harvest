// No SUPABASE_URL: the functions must still work on built-in demo data.
import './deno-shim.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunction } from './deno-shim.ts';

const search = await loadFunction('../functions/search/index.ts');
const go = await loadFunction('../functions/go/index.ts');
const ingest = await loadFunction('../functions/ingest/index.ts');

const get = (h: any, path: string) => h(new Request(`http://local/${path}`));

test('demo search returns a listing per store and every offer type', async () => {
  const res = await get(search, '?q=Sony%20WH-1000XM5');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.listings.length, 3);
  assert.ok(body.listings.every((l: any) => l.priceStats && l.mrp));
  assert.ok(body.offers.some((o: any) => o.paymentApp === 'phonepe'));
  assert.ok(body.offers.some((o: any) => o.code === 'FLIP200'));
});

test('search rejects card-number-looking and too-short queries', async () => {
  assert.equal((await get(search, '?q=4111%201111%201111%201111')).status, 400);
  assert.equal((await get(search, '?q=a')).status, 400);
});

test('second search is served from cache', async () => {
  await get(search, '?q=pixel%209');
  const res = await get(search, '?q=PIXEL%20%209');
  assert.equal(res.headers.get('x-cache'), 'HIT');
});

test('go redirects to known hosts only', async () => {
  const ok = await get(go, '?m=amazon_in&u=' + encodeURIComponent('https://www.amazon.in/s?k=x'));
  assert.equal(ok.status, 302);
  const bad = await get(go, '?m=x&u=' + encodeURIComponent('https://evil.example/'));
  assert.equal(bad.status, 400);
  const http = await get(go, '?m=x&u=' + encodeURIComponent('http://www.amazon.in/'));
  assert.equal(http.status, 400);
});

test('ingest refuses to run without a database', async () => {
  assert.equal((await ingest(new Request('http://local/', { method: 'POST' }))).status, 503);
});
