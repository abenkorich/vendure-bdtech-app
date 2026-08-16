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

**7. `npm run check` and `npm test` stay clean.** Both before every commit.

---

## Local development

```bash
cp .env.example .env    # then fill in the channel token
npm install
npm run ios             # or: npm run android
npm run check           # tsc --noEmit, must be 0 errors
npm test                # must be all green
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

**`EXPO_PUBLIC_*` is inlined at build time.** Changing one needs a bundler
restart, not a reload. And it is readable by anyone who unpacks the app, so no
secret ever goes behind that prefix.

**Unistyles' Babel plugin is rooted at `src`.** A style file outside `src/`
is silently not processed, and its styles will not resolve.

**RTL requires a reload on Android.** `I18nManager.forceRTL` only takes effect
after a restart. Switching to Arabic must show explicit reload UX rather than
appearing to do nothing.

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
