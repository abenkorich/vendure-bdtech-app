# Dzduino App

The Dzduino / BDTech mobile storefront: an [Expo](https://expo.dev) SDK 57 app
on a [Vendure](https://www.vendure.io) backend, serving the same trilingual
(English, French, Arabic) electronics shop as the web storefront.

It shares the web storefront's **GraphQL layer, translation catalogs, business
logic and merchant configuration**, and none of its UI. The web components are
DOM + Tailwind and assume a browser; every screen here is built native.

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
| `npm run lint` | ESLint — must stay at 0 errors and 0 warnings |
| `npm run prebuild` | Regenerate the native projects |

---

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_VENDURE_SHOP_API_URL` | yes | e.g. `https://api.dzduino.dz/shop-api` |
| `EXPO_PUBLIC_VENDURE_CHANNEL_TOKEN` | yes | The real token. The literal `__default_channel__` is rejected by the backend |
| `EXPO_PUBLIC_SITE_URL` | yes in practice | The web storefront's origin. Serves the merchant's site config **and** resolves customizer image paths, so home falls back to a bundled snapshot without it |

`EXPO_PUBLIC_*` values are inlined at build time, so changing one needs a
**rebuild**, not just a bundler restart: they are baked into `expo.extra` when
`app.config.ts` is evaluated. Anyone who unpacks the app can read them, so no
secret may live behind that prefix.

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
| i18n | Shared catalogs + a ported ICU formatter |

## Architecture

```
src/
  app/            expo-router routes; (tabs)/ is the 5-tab shell
  features/       one folder per area: queries (hooks) + screens
  components/ui/  design-system primitives
  design/         tokens + Unistyles registration
  i18n/           locale runtime, ICU formatting, RTL
  lib/            API client, auth, site config, logic shared with the web
  graphql/        gql.tada setup + schema snapshot
messages/         en / fr / ar catalogs, ~2350 keys each
```

Screens compose; they do not fetch. Data access lives in a TanStack Query hook
under `src/features/<area>/`.

## Merchant configuration

The home screen's hero, highlighted categories, search placeholder and logo are
**the merchant's web customizer settings**, not constants in this repo. There is
deliberately no second customizer here: one edit updates both front-ends.

```
customizer (web)
  └─ data/site-config/published.json      on the storefront's disk
       └─ GET /api/site-config?locale=xx  served for non-web clients
            └─ useSiteConfig()             network -> MMKV -> bundled snapshot
```

The bundled layer is load-bearing. Home is the first screen anyone sees, so it
renders a complete storefront even with the config service unreachable; the
catalogue comes from Vendure either way. See [`docs/PLAN.md`](docs/PLAN.md) §11.

## Design

"Precision Instrument" — dark-first, high-contrast, tightly gridded. Colors are
converted from the web storefront's oklch tokens, so it is provably the same
brand. The accent (indigo) marks interactive and stateful things only: price,
stock, CTAs, focus. Prices and specs use tabular numerals so they read as data.

## Internationalization

Three locales (`en`, `fr`, `ar`) sharing the storefront's catalogs, formatted by
its ICU evaluator so a plural renders identically on both platforms.

Arabic is a real rendering path, not a translation toggle: the layout mirrors,
directional icons flip, and switching in or out of it requires an app reload
(`I18nManager`), which the language switcher surfaces rather than hiding.

## Testing

`tests/run.mjs` is a dependency-free harness: it bundles each `*.test.ts` with
esbuild and runs it in Node. Run one file with `node tests/run.mjs <substring>`.

28 files, covering the load-bearing and easy-to-regress rather than UI:

| Area | Guards |
| --- | --- |
| `vendure-contract`, `data-layer-contract`, `checkout-contract` | The copied GraphQL still validates against the **live** API |
| `messages-parity`, `format-message`, `catalogue-strings` | All three catalogs stay in sync and every string resolves |
| `routes`, `notification-routes` | No dead links (the source is scanned for every path it pushes); backend-supplied paths are validated |
| `gallery-images` | A product with only a `featuredAsset` still gets a gallery |
| `site-config`, `site-config-contract` | Merchant config survives hostile input, every snapshot image ships with the app, and the live endpoint still satisfies the app's schema |
| `price-format`, `cart-math`, `tools-calculators` | Money in minor units, cart totals, calculator correctness |
| `adaptive-icon` | The launcher icon stays inside the mask's safe zone |

Tests cannot import React Native (it will not bundle for Node), which is why
pure logic lives in plain `.ts` modules.

Network-dependent tests skip rather than fail when their service is
unreachable, so an offline run reports honestly. To exercise the site-config
contract against a local storefront:

```bash
SITE_CONFIG_URL=http://localhost:4321 node tests/run.mjs site-config-contract
```

## Documentation

- [`docs/PLAN.md`](docs/PLAN.md) — scope, decisions, verified backend facts, what shipped and what did not
- [`docs/CONTRACTS.md`](docs/CONTRACTS.md) — interfaces between workstreams
- [`AGENTS.md`](AGENTS.md) — conventions and the gotchas that cost real time
