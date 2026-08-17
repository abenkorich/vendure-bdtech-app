# Dzduino Mobile App — Build Plan

Native iOS + Android app for the Dzduino / BDTech Vendure store, sharing the
GraphQL layer, i18n catalogs and business logic of
`vendure-bdtech-storefront-astro` while presenting a **native-first** UI.

Status: **v1 built and verified on an iOS simulator against the live backend.**
See "Delivered" at the end for what is done and what is not.

---

## 1. Decisions (locked)

| Question | Decision |
| --- | --- |
| Distribution | App Store + Play Store eventually. **Local dev first**; no EAS/store setup until the go-ahead. Bundle IDs reserved now so nothing has to be renamed later. |
| Backend | `https://api.dzduino.dz/shop-api` for development. Verified live. |
| Styling | Unistyles 3.3 (recommended, accepted) |
| Payments | **COD only** in v1. SATIM designed for but not implemented. |
| Design | Native-first identity, agent's choice — see §4 |
| Push + deep links | In scope for v1 |
| Repo | New standalone git repo, remote `abenkorich/vendure-bdtech-app` |

### Verified backend facts

Probed live against `api.dzduino.dz` while writing this plan:

- `activeChannel`: code `__default_channel__`, currency **DZD**, languages `en`, `ar`, `fr`.
- `dealProducts` / `newArrivalProducts` **exist** but take `ProductListOptions`,
  not `MerchandisingListOptions`. This is the pre-merchandising-plugin backend
  the storefront README flags. The app's rail queries must be written against
  `ProductListOptions`, or those two rails fail exactly as they do on the web.
- Blog API is complete (`blogPosts`, `blogRail`, `blogCategories`, `blogAuthors`).
- `activeSocialLoginProviders` + `authenticate` present → social sign-in is live.
- `aiShopChatSettings` present → the AI shop assistant is available.
- `setYalidinePickupCenter` present → stopdesk selection is a real mutation.

---

## 2. Stack

| Layer | Choice | Version |
| --- | --- | --- |
| Runtime | Expo SDK | 57 |
| | React Native | 0.87 (New Architecture) |
| Navigation | expo-router (typed routes) | 57 |
| Styling | react-native-unistyles | 3.3 |
| Animation | react-native-reanimated + gesture-handler | 4.x |
| Data | @tanstack/react-query | 5.101 |
| GraphQL | gql.tada + graphql (documents copied from the storefront) | — |
| Persistence | react-native-mmkv (query cache, prefs) | 3.x |
| Secrets | expo-secure-store (Vendure auth token) | — |
| i18n | the storefront's three catalogs + a small ICU formatter | — |
| Lists | @shopify/flash-list | 2.x |
| Images | expo-image | — |
| Push | expo-notifications | — |
| Language | TypeScript, `strict` | 5.9 |

**Why Unistyles over NativeWind:** compile-time styles with no class-name
runtime, first-class theme + breakpoint + RTL variants, and it maps directly
onto the storefront's existing token model (`src/config/theme.ts`: oklch accent
presets, radius scale, density scale). NativeWind would buy class-name parity
with the web, but the web components are not portable anyway, so the parity is
worth little.

---

## 3. What is shared vs. rebuilt

**Copied nearly verbatim** (framework-agnostic):

- `src/lib/vendure/{queries,mutations,fragments}.ts` — ~2200 lines of GraphQL
- `src/lib/vendure/{yalidine,zrexpress,social-auth,shop-chat,blog,merchandising}.ts`
- `messages/{en,fr,ar}.json` — 2240 keys each
- `src/lib/{format,price-filter,href,merchandising-helpers,images}.ts`
- `src/lib/tools/*` — the calculator engines (pure functions)

**Rewritten thin:**

- `lib/vendure/api.ts` — same request shape, but SecureStore instead of
  cookies, and no `'use cache'` build directive.

**Rebuilt native (no reuse):** all ~600 files under `src/components/**`. They
are DOM + Tailwind + shadcn and assume a browser.

**Out of scope for v1:** the site customizer and print-cut flow. Both are
desktop/admin-shaped.

---

## 4. Design direction

**"Precision Instrument"** — an electronics retailer should feel like a piece of
lab equipment: dark-first, high-contrast, tightly gridded, with the brand accent
used as a signal rather than decoration.

- **Dark-first**, light theme fully supported. Deep neutral surfaces with an
  elevation ladder built from tint, not shadow.
- **Accent as signal.** The storefront's oklch accent drives only interactive
  and state affordances: price, stock, CTAs, focus. Never large fills.
- **Type:** one variable grotesk, tight tracking on numerals so prices, SKUs and
  specs read as tabular data. Arabic swaps to Cairo.
- **Motion:** Reanimated worklets throughout. Shared-element product
  transitions, spring-driven bottom sheets, skeleton → content crossfades,
  haptics on cart mutations. Nothing longer than 300ms.
- **Navigation:** 5 bottom tabs (Home, Shop, Search, Cart, Account), native
  large-title headers, bottom sheets for filters and variant selection.
- **Density:** a compact spec-sheet grid on product detail — this catalogue is
  full of components with tables of attributes, and that should look deliberate.

The `hallmark` skill runs first to extract the storefront's actual brand
identity (accent hue, type scale, radius, elevation) so the app is recognisably
the same brand rather than a fresh invention.

---

## 5. Scope — v1

| Area | Screens |
| --- | --- |
| Home | merchandising rails, hero, categories, deals, new arrivals, blog rail |
| Catalogue | collection tree, collection detail, product detail w/ variants + specs, compare |
| Search | instant search, filters + facets (bottom sheet), recent + suggestions |
| Cart | line items, qty, promo codes, stock warnings |
| Checkout | address book, Yalidine/ZRExpress + stopdesk picker, **COD**, order confirmation |
| Account | sign in / register / reset, social sign-in, orders, order detail, addresses, profile, wishlist |
| Content | blog list + post, info pages, tools/calculators |
| System | i18n + RTL, theming, push, deep links, offline cache, error + empty states |

Deferred: SATIM payment, AI shop chat, fabrication quotes, customizer, print-cut.

---

## 6. Execution — parallel agents

**Phase 0 (me, serial):** repo init, Expo scaffold, expo-router skeleton,
Unistyles registration, TS + lint config, the shared-code copy from the
storefront, `AGENTS.md`. Everything else depends on this, so it is not
parallelised.

**Phase 1 (6 agents in parallel):**

| # | Agent | Owns |
| --- | --- | --- |
| 1 | design-system | tokens, primitives, motion, iconography, skeletons |
| 2 | data-layer | Vendure client, auth + SecureStore, TanStack Query hooks, MMKV persistence |
| 3 | catalogue | home, collections, product detail, compare |
| 4 | search | search screen, facets, filter sheet, history |
| 5 | commerce | cart, checkout, DZ shipping, COD, confirmation |
| 6 | account-content | auth screens, account, wishlist, blog, tools |

Agents 3–6 depend on 1 and 2, so those two land their public interfaces first
and the rest build against the contract. Model routing: `gpt-5.5`/low for
implementation, `claude-fable-5` for design and review.

**Phase 2 (serial, me):** i18n + RTL pass, push + deep links, integration on a
real simulator, performance pass, review, commit.

---

## 7. Verification

Following the storefront's hard-won lesson that the dangerous bugs are the
*silent* ones:

- `tsc --noEmit` and lint clean before every commit.
- Unit tests for the pure logic that was copied (price filtering, formatting,
  calculators, message parity across the three catalogs).
- Every screen booted on an **iOS simulator and an Android emulator**, against
  the real backend, in all three locales — Arabic included, since RTL is a real
  rendering path and not a translation toggle.
- Cart and checkout exercised end to end. **No real order is ever placed:** the
  backend carries live payment configuration. Stop at the final confirm.
- Commit as we go, messages explaining why a shape changed and what was verified.

---

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| RTL requires an app reload on Android (`I18nManager`) | Explicit reload UX on language switch; decided up front, not patched in |
| Backend predates the merchandising plugin | Rails written against `ProductListOptions` (verified signature) |
| gql.tada needs a generated `graphql-env.d.ts` | Regenerate against the live schema during Phase 0 |
| Social sign-in requires native config | Google/Apple entitlements deferred to the pre-ship pass; email auth in v1 |
| Store review needs Apple Sign-In if Google ships | Both land together in the pre-ship pass |


---

## 10. Delivered

25 routes, ~24k lines, verified on an iPhone 17 Pro simulator against
`api.dzduino.dz` in English and Arabic, light and dark.

| Area | State |
| --- | --- |
| Home, collections, product detail, search | Verified on device with real data |
| Cart, checkout (COD, Yalidine/ZRExpress stopdesk), order confirmation | Verified up to the final confirm; **no order was ever placed** |
| Auth, account, orders, addresses | Built; auth screens verified |
| Wishlist, compare | Built, device-local (no backend support exists) |
| Blog, six calculators | Verified on device |
| i18n (en/fr/ar), RTL, language switcher | Verified in Arabic |
| Push notifications, deep links | Built; deep links verified, push needs a device |

### Bugs that only running it could find

Every one of these passed `tsc` and bundled cleanly:

1. **`SafeAreaView` broke theming.** It renders a native spec component the
   Unistyles Babel plugin cannot process, so its themed style resolved once and
   never updated: dark mode left a white background under white text.
2. **Unistyles init order.** Configuring it at the top of `_layout.tsx` was not
   early enough, because expo-router executes route modules first. Adding one
   import to the tab layout took down the whole app.
3. **Hermes has no `Intl.PluralRules`.** Every pluralised string crashed its
   screen. Node implements it, so the formatter's own tests passed.
4. **A never-resolving skeleton.** Products with no image showed a shimmer
   forever rather than a placeholder, which reads as a broken screen.
5. **Dead links.** `/tools`, `/blog`, `/wishlist`, `/compare`, `/checkout` were
   linked from the UI before they existed; `router.push` to a missing route
   fails silently. `tests/routes.test.ts` now guards this.
6. **Unreachable features.** Wishlist and compare were fully built but nothing
   could add to them, and the whole catalogue rendered English literals in
   Arabic because the i18n runtime landed after the feature work.

### Not done

- **SATIM payment.** Deferred by decision; the payment step is structured so
  adding a method does not mean restructuring.
- **Android.** Never built or run. Expect RTL and edge-to-edge differences.
- **Store submission.** No EAS config, signing, icons or splash art.
- **Push delivery.** No device registry on the backend, and no real device test.
- **Customer flows against real data.** No account was registered, no order
  placed, no existing customer's data touched.
