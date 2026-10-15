-- Catalog: stores, offers, review queue, price history, admin allowlist.
-- The public app never reads these tables directly. Only the edge functions
-- (service role) and signed-in admins (via ops-web) can.

-- ---------------------------------------------------------------------------
-- Admins: who may use ops-web. Add yourself after your first sign-in:
--   insert into public.admins (email) values ('you@example.com');
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  email text primary key check (email = lower(email))
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create policy "admins can see admins" on public.admins
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Merchants
-- ---------------------------------------------------------------------------
create table if not exists public.merchants (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  enabled boolean not null default true,
  -- Which code path fetches listings: mock | flipkart | amazon_in
  adapter text not null default 'mock',
  affiliate_tag text,
  -- Hosts the /go redirect may send people to for this store.
  allowed_hosts text[] not null default '{}',
  cache_minutes int not null default 90 check (cache_minutes between 1 and 1440),
  -- Page the ingest job reads for bank-offer banners (optional).
  offer_page_url text,
  -- Regex parses at/above this confidence go live without review. NULL = always review.
  auto_publish_min numeric check (auto_publish_min is null or auto_publish_min between 0 and 1),
  last_ok_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.merchants enable row level security;
create policy "admins manage merchants" on public.merchants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Offers
-- ---------------------------------------------------------------------------
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  -- NULL merchant = applies on every store (e.g. a UPI app's own offer).
  merchant_id text references public.merchants(id) on update cascade on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'live', 'rejected', 'expired')),
  source text not null check (source in ('api', 'regex', 'llm', 'manual', 'mock')),

  kind text not null check (kind in ('percent', 'flat')),
  value numeric not null check (value > 0),
  max_cap numeric check (max_cap is null or max_cap >= 0),
  min_spend numeric check (min_spend is null or min_spend >= 0),

  issuer text,
  network text check (network is null or network in ('visa', 'mastercard', 'rupay', 'amex', 'diners')),
  card_type text check (card_type is null or card_type in ('credit', 'debit')),
  tiers text[],
  payment_app text,
  portal text,
  code text,

  stack_group text not null default 'merchant'
    check (stack_group in ('bank', 'network', 'merchant', 'payment', 'coupon', 'portal')),
  stackable boolean not null default true,
  emi_only boolean not null default false,
  requires_exchange boolean not null default false,
  reward_kind text not null default 'instant' check (reward_kind in ('instant', 'cashback', 'points')),

  label text not null,
  -- The banner text exactly as scraped, shown beside the parse in the review queue.
  raw_text text,
  confidence numeric check (confidence is null or confidence between 0 and 1),
  valid_from timestamptz,
  valid_until timestamptz,

  -- Meaning-hash used to dedupe crawls. A rejected row stays rejected.
  fingerprint text,
  last_seen_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Plain (non-expression) unique index so PostgREST can upsert on it.
-- Rows without a fingerprint (hand-made offers) are never treated as duplicates.
create unique index if not exists offers_merchant_fingerprint_key
  on public.offers (merchant_id, fingerprint);
create index if not exists offers_status_idx on public.offers (status, merchant_id);

alter table public.offers enable row level security;
create policy "admins manage offers" on public.offers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Stamp who changed the status, and when.
create or replace function public.offers_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status and auth.jwt() ->> 'email' is not null then
    new.reviewed_by = lower(auth.jwt() ->> 'email');
    new.reviewed_at = now();
  end if;
  return new;
end;
$$;
drop trigger if exists offers_touch_trg on public.offers;
create trigger offers_touch_trg before update on public.offers
  for each row execute function public.offers_touch();

-- ---------------------------------------------------------------------------
-- Banners nobody could parse
-- ---------------------------------------------------------------------------
create table if not exists public.parse_failures (
  id bigint generated always as identity primary key,
  merchant_id text references public.merchants(id) on update cascade on delete cascade,
  raw_text text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (merchant_id, raw_text)
);
alter table public.parse_failures enable row level security;
create policy "admins manage parse failures" on public.parse_failures
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Anonymous price history: product query + store + price. Nothing about users.
-- ---------------------------------------------------------------------------
create table if not exists public.price_history (
  id bigint generated always as identity primary key,
  query_key text not null,
  merchant_id text not null,
  price numeric not null check (price > 0),
  mrp numeric,
  seen_at timestamptz not null default now()
);
create index if not exists price_history_lookup
  on public.price_history (query_key, merchant_id, seen_at desc);
alter table public.price_history enable row level security;
create policy "admins read price history" on public.price_history
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Existing telemetry: let admins read it, and close the view loophole.
-- (Views run with their owner's rights unless security_invoker is set, which
--  would have exposed them to anyone holding the public anon key.)
-- ---------------------------------------------------------------------------
create policy "admins read search events" on public.search_events
  for select to authenticated using (public.is_admin());
create policy "admins read click events" on public.click_events
  for select to authenticated using (public.is_admin());

alter view public.top_queries_7d set (security_invoker = true);
alter view public.clicks_by_merchant_7d set (security_invoker = true);
revoke all on public.top_queries_7d, public.clicks_by_merchant_7d from anon;

-- ---------------------------------------------------------------------------
-- Housekeeping (called by the ingest function, service role only)
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_offers(stale_after interval default interval '3 days')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update public.offers
     set status = 'expired'
   where status = 'live'
     and (
       (valid_until is not null and valid_until < now())
       or (source in ('regex', 'llm', 'api') and last_seen_at is not null and last_seen_at < now() - stale_after)
     );
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.prune_price_history(keep interval default interval '180 days')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.price_history where seen_at < now() - keep;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.expire_stale_offers(interval), public.prune_price_history(interval)
  from public, anon, authenticated;
grant execute on function public.expire_stale_offers(interval), public.prune_price_history(interval)
  to service_role;

-- ---------------------------------------------------------------------------
-- Starter stores. They run on demo data until you switch the adapter.
-- ---------------------------------------------------------------------------
insert into public.merchants (id, name, adapter, affiliate_tag, allowed_hosts) values
  ('amazon_in', 'Amazon.in', 'mock', null, '{amazon.in,www.amazon.in,amzn.to}'),
  ('flipkart',  'Flipkart',  'mock', null, '{flipkart.com,www.flipkart.com,dl.flipkart.com}'),
  ('croma',     'Croma',     'mock', null, '{croma.com,www.croma.com}')
on conflict (id) do nothing;
