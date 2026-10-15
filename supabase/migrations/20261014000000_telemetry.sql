-- Anonymous telemetry. Deliberately no user id, device id, IP or user agent.

create table if not exists public.search_events (
  id bigint generated always as identity primary key,
  query text not null check (char_length(query) <= 120),
  result_count int not null default 0,
  cache_hit boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.click_events (
  id bigint generated always as identity primary key,
  merchant_id text not null,
  created_at timestamptz not null default now()
);

-- Only the service role (edge functions) can write; nobody can read via the anon key.
alter table public.search_events enable row level security;
alter table public.click_events enable row level security;

-- Handy views for the ops dashboard later (Phase 2).
create or replace view public.top_queries_7d as
  select query, count(*) as searches
  from public.search_events
  where created_at > now() - interval '7 days'
  group by query
  order by searches desc
  limit 100;

create or replace view public.clicks_by_merchant_7d as
  select merchant_id, count(*) as clicks
  from public.click_events
  where created_at > now() - interval '7 days'
  group by merchant_id
  order by clicks desc;
