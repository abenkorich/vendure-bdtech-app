# Working notes for contributors and agents

Durable context for the Dzduino mobile app. Read this before changing anything
structural.

One-line summary: **an Expo SDK 57 app that shares its GraphQL layer, i18n
catalogs and business logic with the Astro web storefront, but shares none of
its UI.**

---

## Orientation

| Question | Answer |
| --- | --- |
| Where do routes live? | `src/app/**` (expo-router, file-based) |
| Where are the tabs? | `src/app/(tabs)/` |
| Where does data get fetched? | TanStack Query hooks in `src/features/**` |
| Where is the API client? | `src/lib/vendure/api.ts` |
| Where are design tokens? | `src/design/tokens.ts` |
| Where do translations live? | `messages/{en,fr,ar}.json` |

Full rationale in [`docs/PLAN.md`](docs/PLAN.md).

---

## Rules that are not negotiable

**1. Never edit a file copied from the web storefront without saying why.**
Everything under `src/lib/vendure/` (except `api.ts`), `src/lib/tools/`, and
the pure helpers in `src/lib/` are copies kept diffable against
`../vendure-bdtech-storefront-astro`. If you must change one, add a comment
naming what forced it.

**2. The channel token has no default.** The backend rejects the literal
`__default_channel__`. `src/lib/env.ts` throws when it is missing, on purpose:
without it every screen renders empty with `CHANNEL_NOT_FOUND` in the console
and nothing else. Copy `.env.example` to `.env` before running anything.

**3. `Money` is minor units.** Vendure returns integer centimes. Never render
it raw; go through the formatting helpers. A price shown 100x too large is the
kind of bug that survives review because it looks like a real number.

**4. Use the spacing/radius/type scales, not raw numbers.** An arbitrary
`padding: 13` is what makes one screen look subtly wrong next to the rest.

**5. The accent color is a signal, not decoration.** It marks interactive and
stateful things: price, stock, CTAs, focus. Never a large decorative fill.

**6. Arabic is a rendering path, not a translation toggle.** Anything with
directional layout (rows, icons, chevrons, animations, swipes) must be checked
in Arabic. See RTL below.

**7. `npm run check`, `npm test` and `npm run lint` stay clean.** All three
before every commit. Lint is at 0 errors and 0 warnings; keep it there.

---

## Local development

```bash
cp .env.example .env    # then fill in the channel token
npm install
npm run ios             # or: npm run android
npm run check           # tsc --noEmit, must be 0 errors
npm test                # must be all green
npm run lint            # must be 0 errors and 0 warnings
```

**A dev build is required, not Expo Go.** Unistyles, MMKV, Reanimated and
SecureStore all have native code. `npx expo start` alone will not work against
Expo Go.

### Backend

`https://api.dzduino.dz/shop-api` — the real production catalogue, with real
customer data. It is fine to read from and to create dedicated test records in,
but:

**Never complete an order in checkout.** That backend carries live payment
configuration. Exercise the flow up to the final confirm, then stop.

Verified channel facts: currency `DZD`, languages `en`/`ar`/`fr`,
`dealProducts` and `newArrivalProducts` take `ProductListOptions` (**not**
`MerchandisingListOptions` — this backend predates the merchandising plugin,
which is why `/deals` and `/new` 500 on the web storefront).

---

## Adding a screen

```
1. src/app/(tabs)/thing.tsx        or src/app/thing/[slug].tsx
2. src/features/thing/             hooks (queries) + components
3. messages/{en,fr,ar}.json        all three, or the parity test fails
```

Data fetching goes in a `useQuery` hook under `src/features/<area>/`, never
inline in a screen component. Screens compose; they do not fetch.

---

## Testing

`tests/run.mjs` is a dependency-free harness: it bundles each `*.test.ts` with
esbuild and runs it in Node. Run one file with `node tests/run.mjs <substring>`.

**Do not import React Native from a test.** It cannot be bundled for Node and
the failure (`Unexpected "typeof"`) does not name the real cause. That includes
anything importing `@/lib/env`, which pulls in expo-constants. Test pure logic
here; test rendering on a device.

| Test | Covers |
| --- | --- |
| `vendure-contract.test.ts` | The copied GraphQL still validates against the live API |
| `messages-parity.test.ts` | All three catalogs expose the same keys |

The contract test is the highest-value one in the project: gql.tada validates
against a *snapshot* (`src/graphql/graphql-env.d.ts`), so backend drift is
invisible to `tsc` and shows up as an empty screen at runtime.

---

## Gotchas

**Site config comes from the web storefront.** The home screen's hero,
categories, search terms and logo are the merchant's customizer settings,
served by `GET /api/site-config` on the storefront and cached in MMKV with a
bundled fallback (`src/lib/site-config/`). Point `EXPO_PUBLIC_SITE_URL` at a
running storefront to see live config; without one the app renders the bundled
snapshot, which is the intended behaviour rather than a failure.

**Anything from site config is a web-root-relative path.** Banner and logo URLs
look like `/customizer/banners/x.jpg` and resolve to nothing on a device. Always
put them through `absoluteAsset()`; forgetting it renders a blank image with no
error.

**`EXPO_PUBLIC_*` is inlined at build time.** Changing one needs a bundler
restart, not a reload. And it is readable by anyone who unpacks the app, so no
secret ever goes behind that prefix.

**Unistyles' Babel plugin is rooted at `src`.** A style file outside `src/`
is silently not processed, and its styles will not resolve.

**RTL requires a reload on Android.** `I18nManager.forceRTL` only takes effect
after a restart. Switching to Arabic must show explicit reload UX rather than
appearing to do nothing.

**Drive the emulator by element bounds, not by eye.** `adb shell uiautomator
dump` gives exact coordinates. Estimating a button's position from a
screenshot wastes a lot of time looking like a broken button when the tap
simply landed on empty space.

**Adding a native module needs `pod install` on iOS, not just a rebuild.**
`npx expo run:ios` can reuse a cached workspace and produce an app *without*
the new pod, which then crashes at the first use of that module. Run
`cd ios && pod install` after adding one. Note that most Expo pods link
statically, so `ls Dzduino.app/Frameworks` is the wrong way to check whether
one is present; look for `-l<PodName>` in the build log instead.

**The Android emulator cannot reach Metro on the host's LAN address.** Run
`adb reverse tcp:8081 tcp:8081` or the dev build shows a black screen with
nothing in logcat to explain it.

**Hermes lacks `Intl.PluralRules`.** Polyfilled in `src/lib/intl-polyfill.ts`,
loaded from `index.js`. Do not remove it: without it every pluralised string
crashes the screen rendering it. A test that formats a plural in Node proves
nothing here, because Node implements the API natively; only
`tests/plural-polyfill.test.ts` exercises the code path the device uses. It
also catches the quieter failure, where the polyfill loads without a locale's
data and Arabic silently falls back to English rules, turning the dual
"منتجان" into "2 منتج".

**Checking a native module is linked: match the symbol, not the word.** Counting
symbols containing "gradient" in the app binary looks like proof and is not:
2469 of them are RNSVG's own gradient classes, and zero contain
"EXLinearGradient". expo-linear-gradient is Swift, so its symbols carry the
mangled module name. `nm Dzduino.app/Dzduino.debug.dylib | grep -c
ExpoLinearGradient` is the check that means something (174 symbols), and
`xcrun swift-demangle` makes the result readable.

On Android the equivalent is the class definition, not a word: pull the APK
(`adb shell pm path`), unzip `classes*.dex` and grep for
`Lexpo/modules/lineargradient/LinearGradientView;`. The dex index is not
stable across builds, so naming a specific `classesN.dex` proves nothing.

**Unistyles is configured in `index.js`, not `app/_layout.tsx`.** expo-router
executes route modules before the root layout body, so configuring it there is
too late and the app dies with "no theme has been selected yet".

**A new native dependency costs everyone a rebuild.** Adding one mid-stream
breaks the app for anyone who has not rebuilt. Weigh that against what it buys.

**Never use `SafeAreaView`.** Use `Screen` from `@/components/ui/screen`.
`SafeAreaView` renders a native spec component that Unistyles' Babel plugin
cannot process, so its themed style resolves once and never updates: the tab bar
goes dark, the screen background stays white, and the text becomes invisible.
The same applies to any third-party component wrapping a native view. If a
themed style will not react to a theme change, this is why.

**Elevation is tint, not shadow.** Shadows look muddy on the dark surfaces this
app mostly lives on. Raise a surface with `surfaceElevated` + a hairline border.

---

## Verification expectations

The web storefront's hard lesson was that its worst bugs were *silent*: pages
that rendered but were inert. The mobile equivalents are a screen that renders
skeletons forever because a query key never resolves, and a layout that is
subtly broken only in Arabic.

So: run it. Check the screen against a real backend, in more than one locale,
before committing. Type checks and unit tests would not have caught any of the
bugs that actually shipped on the web side.

Commit as you go, with messages explaining *why* a shape changed and what was
verified.


**Production runs the Next storefront, not the Astro one.** `x-powered-by:
Next.js` on www.dzduino.dz. That single fact explains both app-visible
failures, and it is why guessing at server config was wrong:

- `GET /api/site-config` 500s with `content-type: text/plain`. The Next app has
  only `enter-preview` and `exit-preview` under `api/site-config`; the public
  GET route exists **only in the Astro repo**, which is not deployed.
- `/customizer/banners/<id>.jpg` 404s for the same reason.

Verified by running the Astro build locally (`node dist/server/entry.mjs`):
both answer 200 there, so the code is correct and the deployment is the gap.
Do not work around either in the app; it already falls back to its bundled
snapshot and a brand plate.

Check which server is live before diagnosing anything here:
`curl -sI https://www.dzduino.dz/en | grep x-powered-by`


**PRODUCTION IS BROKEN: add-to-cart fails (backend, 2026-08-17).**
`addItemToOrder` returns `column Customer.customFieldsMarketingemailoptin does
not exist`, so no one can buy anything on the app *or* the website. Browsing is
unaffected, which is why the store looks healthy.

Diagnosed, not guessed. The `campaign-pro` plugin declares a
`marketingEmailOptIn` custom field on Customer; the migration that adds the
column exists at
`vendure-ecommerce-platform/src/migrations/1820000000000-campaign-pro-plugin.ts`
(`ADD COLUMN IF NOT EXISTS "customFieldsMarketingemailoptin"`), and
`vendure-config.ts` sets `synchronize: false`, so schema changes only land when
migrations are run. It has not been run against the production database.

Fix: run the pending migrations on the production Vendure instance. Nothing to
change in the app. Reproduce with a bare `addItemToOrder` mutation against the
shop api, no app involved.

The same day's work also renamed `dealProducts(options:)` from
`ProductListOptions` to `MerchandisingListOptions`, handled in
`lib/vendure/rails.ts`. `newArrivalProducts` became callable at the same time
(the new input carries `since`), but the rail still uses `products` sorted by
createdAt, which needs no cutoff date and is already verified on device.
