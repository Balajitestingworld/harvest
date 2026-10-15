# Harvest ops-web

A no-build admin site for the people running Harvest. Plain ES modules; host the folder anywhere static.

## Try it now (no setup)
`npm run ops` from the repo root, then open http://localhost:5173. With `config.js` empty it runs in **demo mode**: sample offers, nothing saved.

## Connect it to Supabase
1. Run the migrations in `supabase/migrations`.
2. Make yourself an admin (SQL editor): `insert into admins(email) values ('you@example.com');`
3. Fill `config.js` with your project URL and anon key. Sign in with the magic link.

## Screens
- **Review** – offers waiting for a person (edit, approve, reject). Everything the reader isn't sure about lands here.
- **Offers** – all offers; add one by hand, filter, expire.
- **Stores** – turn stores on/off, set affiliate tag, cache time, auto-publish confidence, refresh now.
- **Banners** – paste a store's banner text to see how it would be read.
- **Parser** – try any sentence against the reader.
- **Activity** – last errors and unreadable banners.

Banner text from stores is untrusted: the site only renders it as plain text.
After changing `packages/core`, run `npm run build:ops-core` to refresh `vendor/core`.
