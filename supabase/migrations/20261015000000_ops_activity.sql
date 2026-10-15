-- Ops activity: totals, previous-period comparison and daily series for the
-- Activity page. One call, any window up to 90 days.
--
-- security invoker on purpose: the row-level policies on search_events and
-- click_events already limit reads to signed-in admins, so this function adds
-- no new access. Anonymous callers are refused outright.
--
-- Returns, for the window (w days) and the w days before it:
--   searches / clicks: { current, previous, daily[] }   daily is oldest day first
--   queries:   top 10 search texts with current, previous and daily counts
--   merchants: every store with clicks, previous and daily counts

create or replace function public.ops_activity(p_days int default 7)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with win as (
    select least(greatest(coalesce(p_days, 7), 1), 90) as w,
           now() as t_end
  ),
  -- age = whole days before now (0 = last 24h). Rows from the last 2w days only.
  sv as (
    select greatest(0, floor(extract(epoch from win.t_end - e.created_at) / 86400))::int as age,
           e.query
    from public.search_events e, win
    where e.created_at > win.t_end - make_interval(days => win.w * 2)
  ),
  cv as (
    select greatest(0, floor(extract(epoch from win.t_end - e.created_at) / 86400))::int as age,
           e.merchant_id
    from public.click_events e, win
    where e.created_at > win.t_end - make_interval(days => win.w * 2)
  ),
  days as (
    select g.k, (select w from win) - 1 - g.k as age
    from generate_series(0, (select w from win) - 1) as g(k)
  ),
  s_daily as (
    select days.k, count(sv.age) as n
    from days left join sv on sv.age = days.age
    group by days.k
  ),
  c_daily as (
    select days.k, count(cv.age) as n
    from days left join cv on cv.age = days.age
    group by days.k
  ),
  q_rows as (
    select sv.query,
           count(*) filter (where sv.age < (select w from win)) as searches,
           count(*) filter (where sv.age >= (select w from win)) as previous,
           (select jsonb_agg(coalesce(x.n, 0) order by days.k)
              from days
              left join (select query, age, count(*) as n from sv group by query, age) x
                on x.age = days.age and x.query = sv.query) as daily
    from sv
    group by sv.query
    having count(*) filter (where sv.age < (select w from win)) > 0
    order by searches desc
    limit 10
  ),
  m_rows as (
    select cv.merchant_id,
           count(*) filter (where cv.age < (select w from win)) as clicks,
           count(*) filter (where cv.age >= (select w from win)) as previous,
           (select jsonb_agg(coalesce(x.n, 0) order by days.k)
              from days
              left join (select merchant_id, age, count(*) as n from cv group by merchant_id, age) x
                on x.age = days.age and x.merchant_id = cv.merchant_id) as daily
    from cv
    group by cv.merchant_id
    order by clicks desc
  )
  select jsonb_build_object(
    'days', (select w from win),
    'searches', jsonb_build_object(
      'current', (select count(*) from sv where age < (select w from win)),
      'previous', (select count(*) from sv where age >= (select w from win)),
      'daily', (select coalesce(jsonb_agg(n order by k), '[]'::jsonb) from s_daily)
    ),
    'clicks', jsonb_build_object(
      'current', (select count(*) from cv where age < (select w from win)),
      'previous', (select count(*) from cv where age >= (select w from win)),
      'daily', (select coalesce(jsonb_agg(n order by k), '[]'::jsonb) from c_daily)
    ),
    'queries', (select coalesce(jsonb_agg(jsonb_build_object(
        'query', query, 'searches', searches, 'previous', previous, 'daily', daily)
        order by searches desc), '[]'::jsonb) from q_rows),
    'merchants', (select coalesce(jsonb_agg(jsonb_build_object(
        'merchant_id', merchant_id, 'clicks', clicks, 'previous', previous, 'daily', daily)
        order by clicks desc), '[]'::jsonb) from m_rows)
  );
$$;

revoke execute on function public.ops_activity(int) from public, anon;
grant execute on function public.ops_activity(int) to authenticated, service_role;
