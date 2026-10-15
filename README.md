# Harvest

Privacy-first card offer finder for India. One Expo codebase builds the **website** (landing page + web search tool), the **Android app** and the **iPhone app**; a Supabase edge function aggregates prices and bank offers.

```
harvest/
├─ packages/core/         Shared logic, no dependencies — tested (83 unit tests)
│   ├─ types.ts           Offer / Listing / VaultCard / SearchResponse contract
│   ├─ matching.ts        Local matching engine: MIN(price×pct, cap), stacking, EMI, staleness
│   ├─ offer-parser.ts    Regex parser for Indian bank-offer banners → structured JSON
│   ├─ pan-guard.ts       Rejects anything that looks like a card number (R-001)
│   ├─ banks.ts           Indian issuers + networks
│   └─ mock.ts            Demo data so everything runs before API keys exist
├─ apps/app/              Expo Router app → Android, iPhone + web
│   ├─ app/index.tsx      Web: landing page with live demo · Android: onboarding/search
│   ├─ app/(tabs)/        Search and My cards
│   ├─ app/add-card.tsx   Add card (bank, network, type — no number field)
│   └─ src/lib/           SecureStore vault, biometric unlock, search API
├─ apps/ops/              Admin site (no build): review queue, offers, stores, parser tester
└─ supabase/
    ├─ functions/search   GET ?q= → listings + all live offers (anonymous, cached)
    ├─ functions/go       Affiliate redirect + anonymous click count
    ├─ functions/ingest   Scheduled: read store banners → parse → live / pending review
    └─ migrations/        Telemetry, catalog (merchants, offers, price history, admins)
```

## Run it

Requires Node 20+.

```bash
npm install
cd apps/app && npx expo install --fix   # aligns native package versions to the installed Expo SDK
cd ../..

npm test          # core unit tests
npm run web       # website at http://localhost:8081
npm run android   # Android emulator, or scan the QR code with Expo Go
```

With no `.env`, the app runs on built-in demo prices and sample offers, so you can click through everything immediately.

> Biometric unlock and SecureStore need a real phone build or Expo Go. On web the vault uses browser storage and skips the lock.

## iPhone

The iPhone app is the same code. On iOS the vault is encrypted by Keychain (this-device-only, so it never syncs to iCloud) and unlocks with Face ID.

- **Try it on your iPhone today, no Mac needed:** install **Expo Go** from the App Store, run `npm run app`, and scan the QR code with the iPhone camera.
- **iOS Simulator:** needs a Mac with Xcode, then `npm run ios`.
- **App Store build, no Mac needed:** EAS builds in the cloud.
  ```bash
  npm i -g eas-cli
  cd apps/app
  eas login
  eas build -p ios        # asks for your Apple Developer account and creates certificates
  eas submit -p ios       # uploads to App Store Connect / TestFlight
  ```
  You need a paid Apple Developer Program membership. The account holder's name (or company, for an organisation account) is shown as the seller on the App Store.

## What's built

- **Offers beyond cards:** UPI/wallet apps, bank shopping portals, coupon codes, cashback vs instant, EMI and exchange toggles.
- **Price history + fake-sale check** (anonymous), shown on each result.
- **Price watch:** list lives on the phone; checks run on-device (background where the OS allows) and notify on a drop.
- **Ops-web:** manage stores and review offers. See `apps/ops/README.md`.
- **Launch material:** `docs/` has operations notes, privacy policy and affiliate disclosure drafts (need a lawyer), store listing copy, and a checklist of what only you can do.

## Tests

```bash
npm test                 # core (83) + backend functions against an in-memory fake database (17)
```
Not yet exercised for real: the Expo app on a device, the SQL migrations on Postgres, the Supabase-backed ops login, live Amazon/Flipkart responses, background tasks. Those need your accounts or a phone; see `docs/LAUNCH_CHECKLIST.md`.

## Connect the backend


```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push                              # telemetry tables
cp supabase/.env.example supabase/.env        # fill in what you have; MERCHANTS=mock works
supabase secrets set --env-file supabase/.env
npm run sync:core                             # copy shared parser/types into the functions
supabase functions deploy search go
```

Then create `apps/app/.env` from `.env.example` with your project URL and anon key, and restart Expo.

Local backend: `supabase functions serve --env-file supabase/.env`, then set `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`.

## Privacy model (how the code enforces it)

| Rule | Where |
|---|---|
| No card numbers stored (R-001) | `pan-guard.ts`, checked in `state/vault.tsx` and `add-card.tsx`; the form has no number field |
| Search carries only the query (R-002) | `src/lib/api.ts` is the only network call; the backend also rejects digit-runs in `q` |
| Vault encrypted + biometric (BR-006) | `vault-storage.ts` (Android Keystore via SecureStore), `auth.ts` |
| Matching on device (BR-004) | `matchSearch()` runs in `useSearch.ts`, never on the server |
| Anonymous telemetry | `_shared/telemetry.ts` writes query text or merchant id only |

## Merchant integrations — status

| Merchant | Prices | Bank offers | Status |
|---|---|---|---|
| Demo (`mock`) | ✅ | ✅ | Works now |
| Flipkart | Affiliate API adapter written | Scraped banners via proxy | Needs affiliate ID/token + scraper key; verify endpoint in your dashboard |
| Amazon.in | Creators API | — | **Stub.** PA-API 5 (named in the blueprint) is deprecated; Amazon now points to the Creators API |
| Croma | — | — | Demo only; no public affiliate API known yet |

## Next slices

1. Fill in the Amazon Creators API adapter once Associates India grants API access.
2. Collect 50–100 real banner strings per merchant and add them as parser test cases.
3. Production builds: `eas build -p android` and `eas build -p ios`.
