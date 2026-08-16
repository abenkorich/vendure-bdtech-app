# Interface contracts

What each parallel workstream may rely on from the others. Agents build
against this document, not against each other's in-progress code.

Anything not listed here is private to its owning area. If you need something
that is not in this document, add it here first.

---

## Owned by: design-system (`src/design/**`, `src/components/ui/**`)

Tokens already exist in `src/design/tokens.ts` and are stable:

```ts
theme.colors    // background surface surfaceElevated text textMuted border
                // brand onBrand brandMuted sale success danger skeleton
theme.spacing   // xs sm md lg xl 2xl 3xl        (4pt grid)
theme.radius    // none sm md lg xl full
theme.typography// display title heading body bodyStrong caption micro
theme.motion    // fast base slow spring
theme.isDark
```

Access inside a component with:

```ts
const styles = StyleSheet.create(theme => ({ ... }));   // preferred
const {theme} = useUnistyles();                          // when you need a value
```

Primitives to be delivered, and their props:

```ts
<Text variant="body|title|caption|..." color="text|textMuted|brand|..." />
<Button variant="primary|secondary|ghost" size="sm|md|lg" loading disabled onPress />
<Price value={number} currencyCode="DZD" size="sm|md|lg" />   // handles minor units
<Card />  <Divider />  <Badge tone="brand|sale|success|danger" />
<Skeleton width height radius />
<Sheet open onClose>  <EmptyState icon title message action />
<ProductCard product={ProductCardData} onPress />
<Stepper value onChange min max />        // cart quantity
<IconSymbol name={IconName} size color /> // single icon indirection
```

---

## Owned by: data-layer (`src/lib/**`, `src/features/*/queries.ts`)

Already stable and usable now:

```ts
import {query, mutate} from '@/lib/vendure/api';
// options: {useAuthToken?, languageCode?, currencyCode?, signal?}
// throws ServerUnreachableError (retryable) or VendureApiError (not)

import {queryClient} from '@/lib/query-client';
import {env} from '@/lib/env';
import {getAuthToken, setAuthToken, clearAuthToken, onAuthTokenChange}
    from '@/lib/auth/token-store';
```

To be delivered:

```ts
// Query keys. Every hook uses this factory; no hand-written key arrays.
queryKeys.product(slug) | .collection(slug, params) | .search(params)
         | .activeOrder() | .customer() | .orders(params) | ...

// Session
useSession()      // {customer, isSignedIn, isLoading}
useSignIn() useSignOut() useRegister()

// Cart. Optimistic: the UI must never wait on a round-trip to reflect a tap.
useActiveOrder() useAddToCart() useAdjustLine() useRemoveLine()

// Shared types, derived from the GraphQL result types (do not re-declare):
ProductCardData, ProductDetail, ActiveOrder, CustomerAddress
```

Rules: screens never call `query()` directly, they use a hook from
`src/features/<area>/`. Anything customer-scoped passes `useAuthToken: true`.

---

## Owned by: i18n (delivered in phase 2, stub in phase 1)

```ts
const t = useTranslations('Product');   // t('addToCart'), t('inStock', {count})
const {locale, setLocale, isRTL} = useLocale();
```

Namespaces available in `messages/*.json`: `Navigation Hero Home HomeSections
Product Sort Filters Cart Checkout OrderStatus Auth Collections Search
Merchandising Verify OrderConfirmation Account NotFound Footer Wishlist
Compare Common Customizer Tools Errors PrintCut ShopChat InfoPages`.

During phase 1, use the real key path in `t()` calls even before the hook
lands. Adding a key means adding it to **all three** catalogs or
`messages-parity.test.ts` fails.

---

## Routes

Agreed up front so cross-linking works before the screens exist:

```
/(tabs)/                      home
/(tabs)/shop                  collection tree
/(tabs)/search                search
/(tabs)/cart                  cart
/(tabs)/account               account hub
/product/[slug]               product detail
/collection/[slug]            collection listing
/checkout                     checkout flow
/order/[code]                 order detail / confirmation
/blog, /blog/[slug]           content
/tools, /tools/[slug]         calculators
/auth/sign-in, /auth/register, /auth/forgot-password
/wishlist, /compare
```

Navigate with `router.push('/product/' + slug)`. Typed routes are on, so a
bad path is a type error.

---

## Boundaries

| Area | Owns | Never touches |
| --- | --- | --- |
| design-system | `src/design/`, `src/components/ui/` | feature folders |
| data-layer | `src/lib/`, `src/features/*/queries.ts` | UI components |
| catalogue | `src/features/{home,collection,product}/` | `ui/`, other features |
| search | `src/features/search/` | `ui/`, other features |
| commerce | `src/features/{cart,checkout}/` | `ui/`, other features |
| account-content | `src/features/{account,auth,blog,tools}/` | `ui/`, other features |

Shared edits (`src/app/(tabs)/_layout.tsx`, `package.json`, `messages/*.json`)
are coordinated through the root agent to avoid clobbering.
