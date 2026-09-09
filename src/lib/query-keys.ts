/**
 * Query key factory.
 *
 * Every hook builds its key here; no hand-written arrays anywhere in the app.
 * Two properties matter and are easy to lose if keys are written by hand:
 *
 * 1. **Invalidation by prefix.** `['catalogue']` and `['customer']` are the two
 *    roots. Signing out drops the `customer` subtree wholesale, and the MMKV
 *    persister whitelists only the `catalogue` subtree — both are one-liners
 *    exactly because the roots are stable.
 * 2. **Stable serialisation.** Params objects go through `stableParams` so
 *    `{take: 12, term: 'x'}` and `{term: 'x', take: 12}` are the same key.
 *    TanStack hashes keys deterministically, but only for the object it is
 *    given; a key holding `undefined` values still differs from one without.
 */

export const CATALOGUE_ROOT = 'catalogue';
export const CUSTOMER_ROOT = 'customer';

/** Drop undefined entries and sort, so equivalent params hash identically. */
export function stableParams(params: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!params) return {};
    const entries = Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries);
}

export const queryKeys = {
    // --- catalogue: safe to persist, identical for every user -------------
    catalogue: () => [CATALOGUE_ROOT] as const,

    product: (slug: string) => [CATALOGUE_ROOT, 'product', slug] as const,
    productCard: (slug: string) => [CATALOGUE_ROOT, 'product-card', slug] as const,

    collections: () => [CATALOGUE_ROOT, 'collections'] as const,
    /** Which of a candidate set carry stock, plus a sample of each. */
    stockedCollections: (slugs: readonly string[], take: number, limit: number) =>
        // `v2` because the cached shape changed from an array to
        // {rails, totals}. The query cache is persisted to MMKV and outlives a
        // code change, so an unversioned key hands an old array to new code
        // and crashes on `data.rails.map`.
        [CATALOGUE_ROOT, 'stocked-collections', 'v2', slugs.join(','), take, limit] as const,
    collectionsFlat: (params?: Record<string, unknown>) =>
        [CATALOGUE_ROOT, 'collections-flat', stableParams(params)] as const,
    collection: (slug: string, params?: Record<string, unknown>) =>
        [CATALOGUE_ROOT, 'collection', slug, stableParams(params)] as const,

    search: (params?: Record<string, unknown>) =>
        [CATALOGUE_ROOT, 'search', stableParams(params)] as const,
    searchOverlay: (term: string) => [CATALOGUE_ROOT, 'search-overlay', term] as const,
    priceBounds: (params?: Record<string, unknown>) =>
        [CATALOGUE_ROOT, 'price-bounds', stableParams(params)] as const,

    deals: (params?: Record<string, unknown>) =>
        [CATALOGUE_ROOT, 'deals', stableParams(params)] as const,
    /** The Explore more feed for a set of collections; paged by TanStack. */
    exploreFeed: (slugs: readonly string[]) => [CATALOGUE_ROOT, 'explore-feed', ...slugs] as const,
    /** A merchant-configured home rail; params carry its whole config. */
    appRail: (params: Record<string, unknown>) => [CATALOGUE_ROOT, 'app-rail', params] as const,
    newArrivals: (params?: Record<string, unknown>) =>
        [CATALOGUE_ROOT, 'new-arrivals', stableParams(params)] as const,

    blogPosts: (params?: Record<string, unknown>) =>
        [CATALOGUE_ROOT, 'blog-posts', stableParams(params)] as const,
    blogRail: (params?: Record<string, unknown>) =>
        [CATALOGUE_ROOT, 'blog-rail', stableParams(params)] as const,
    blogPost: (slug: string) => [CATALOGUE_ROOT, 'blog-post', slug] as const,

    channel: () => [CATALOGUE_ROOT, 'channel'] as const,
    captchaConfig: () => [CATALOGUE_ROOT, 'captcha-config'] as const,
    socialLoginProviders: () => [CATALOGUE_ROOT, 'social-login-providers'] as const,
    countries: () => [CATALOGUE_ROOT, 'countries'] as const,

    // --- customer-scoped: never persisted to MMKV ------------------------
    customer: () => [CUSTOMER_ROOT] as const,

    activeCustomer: () => [CUSTOMER_ROOT, 'active-customer'] as const,
    addresses: () => [CUSTOMER_ROOT, 'addresses'] as const,
    orders: (params?: Record<string, unknown>) =>
        [CUSTOMER_ROOT, 'orders', stableParams(params)] as const,
    order: (code: string) => [CUSTOMER_ROOT, 'order', code] as const,

    activeOrder: () => [CUSTOMER_ROOT, 'active-order'] as const,
    activeOrderForCheckout: () => [CUSTOMER_ROOT, 'active-order-checkout'] as const,
    eligibleShippingMethods: () => [CUSTOMER_ROOT, 'eligible-shipping-methods'] as const,
    eligiblePaymentMethods: () => [CUSTOMER_ROOT, 'eligible-payment-methods'] as const,
} as const;

export type QueryKeys = typeof queryKeys;
