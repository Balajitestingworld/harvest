# Running the offer pipeline

## Schedule ingest
Supabase → SQL editor (needs pg_cron + pg_net extensions enabled):
```sql
select cron.schedule('harvest-ingest', '0 */3 * * *', $$
  select net.http_post(
    url := 'https://<project>.functions.supabase.co/ingest',
    headers := jsonb_build_object('x-ingest-secret', '<INGEST_SECRET>'));
$$);
```
Every run: reads each enabled store's banners → regex reader → live (if confident and the store allows it) or pending → LLM fallback (always pending) → unreadable ones into "Couldn't read". Offers above 60% off or ₹50,000 flat always wait for a person.

## Store status
| Store | Route | Status |
|---|---|---|
| Flipkart | Affiliate API | Adapter written; needs your affiliate ID + token |
| Amazon India | Associates Creators API | Adapter written; field names (esp. the "was" price) must be checked against a real response |
| Croma | none known | Blocked: no affiliate/API route found. Do not scrape without permission. |

## Before trusting auto-publish
Keep `auto_publish_min` empty (everything reviewed) for the first two weeks. Look at the Review queue, then raise it for a store only when approvals are almost always unedited.
