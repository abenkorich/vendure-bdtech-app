# Dzduino App

The Dzduino / BDTech mobile storefront: an [Expo](https://expo.dev) SDK 57 app
on a [Vendure](https://www.vendure.io) backend, serving the same trilingual
(English, French, Arabic) electronics shop as the web storefront.

It shares the web storefront's **GraphQL layer, translation catalogs and
business logic**, and none of its UI. The web components are DOM + Tailwind and
assume a browser; every screen here is built native.

---

## Quick start

```bash
cp .env.example .env      # fill in the Vendure channel token
npm install
npm run ios               # or: npm run android
```

**A dev build is required, not Expo Go.** Unistyles, MMKV, Reanimated and
SecureStore all ship native code.

### Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Metro bundler |
| `npm run ios` / `npm run android` | Build and launch a dev build |
| `npm run check` | `tsc --noEmit` — must stay at 0 errors |
| `npm test` | Unit + contract tests (no framework) |
| `npm run lint` | ESLint |
| `npm run prebuild` | Regenerate the native projects |

---

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_VENDURE_SHOP_API_URL` | yes | e.g. `https://api.dzduino.dz/shop-api` |
| `EXPO_PUBLIC_VENDURE_CHANNEL_TOKEN` | yes | The real token. The literal `__default_channel__` is rejected by the backend |
| `EXPO_PUBLIC_SITE_URL` | no | Canonical origin, used to build shareable links |

`EXPO_PUBLIC_*` values are inlined into the JS bundle at build time: changing
one requires a bundler restart, and anyone who unpacks the app can read them.
No secret may live behind that prefix.

---

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Expo SDK 57, React Native 0.86, New Architecture |
| Navigation | expo-router (typed routes) |
| Styling | Unistyles 3 |
| Animation | Reanimated 4 + Gesture Handler |
| Data | TanStack Query 5, MMKV persistence |
| GraphQL | gql.tada (documents shared with the web storefront) |
| Session | expo-secure-store (device keychain) |

## Architecture

```
src/
  app/            expo-router routes; (tabs)/ is the 5-tab shell
  features/       one folder per area: queries (hooks) + screens
  components/ui/  design-system primitives
  design/         tokens + Unistyles registration
  lib/            API client, auth, and logic shared with the web storefront
  graphql/        gql.tada setup + schema snapshot
messages/         en / fr / ar catalogs, 2240 keys each
```

Screens compose; they do not fetch. Data access lives in a TanStack Query hook
under `src/features/<area>/`.

## Design

"Precision Instrument" — dark-first, high-contrast, tightly gridded. Colors are
converted from the web storefront's oklch tokens, so it is provably the same
brand. The accent (indigo) marks interactive and stateful things only: price,
stock, CTAs, focus. Prices and specs use tabular numerals so they read as data.

## Documentation

- [`docs/PLAN.md`](docs/PLAN.md) — scope, decisions, verified backend facts
- [`docs/CONTRACTS.md`](docs/CONTRACTS.md) — interfaces between workstreams
- [`AGENTS.md`](AGENTS.md) — conventions and gotchas
