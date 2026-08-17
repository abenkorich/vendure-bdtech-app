/**
 * Catalogue copy, keyed by the **real** message paths in `messages/en.json`.
 *
 * TODO(i18n phase 2): replace every `S.x` read with `t('Namespace.key')` once
 * `useTranslations` lands (see docs/CONTRACTS.md). The literals below are the
 * English values already present in all three catalogs, so swapping the lookup
 * is mechanical and adds no new keys — adding one would require editing
 * `messages/{en,fr,ar}.json` together or `messages-parity.test.ts` fails.
 *
 * Every entry names the key path it stands in for. Nothing here is invented:
 * if a string has no key yet it is not in this file, it is a literal at the
 * call site marked with a TODO.
 */
export const S = {
    /** HomeSections.viewAll */
    viewAll: 'View all',
    /** HomeSections.newArrivals.* */
    newArrivalsEyebrow: 'Just landed',
    newArrivalsTitle: 'New arrivals',
    /** Merchandising.dealsTitle / dealsSubtitle */
    dealsTitle: 'Deals',
    dealsSubtitle: 'Discounted products with a compare-at price higher than the selling price.',
    /** HomeSections.categories.* */
    categoriesEyebrow: 'Browse',
    categoriesTitle: 'Shop by category',
    /** HomeSections.blog.* */
    blogEyebrow: 'Journal',
    blogTitle: 'From the blog',
    blogMinRead: 'min read',

    /** Collections.* */
    collectionsTitle: 'Collections',
    collectionsEmpty: 'No collections are available right now.',
    subCollections: 'Sub-collections',
    viewCollection: 'View all',

    /** Sort.* */
    sortPlaceholder: 'Sort by',
    sortNameAsc: 'Name: A to Z',
    sortNameDesc: 'Name: Z to A',
    sortPriceAsc: 'Price: Low to High',
    sortPriceDesc: 'Price: High to Low',

    /** Product.* */
    inStock: 'In Stock',
    outOfStock: 'Out of Stock',
    lowStock: 'Low stock',
    addToCart: 'Add to Cart',
    adding: 'Adding...',
    addedToCart: 'Added to Cart',
    selectOptions: 'Select Options',
    descriptionTitle: 'Description',
    relatedProducts: 'Related Products',
    relatedEyebrow: 'You may also like',
    from: 'From',

    /** Common.sku */
    sku: 'SKU',
    /** Common.loading */
    loading: 'Loading...',

    /** Errors.* */
    somethingWentWrong: 'Something went wrong',
    tryAgain: 'Try again',
    unexpectedError: 'An unexpected error occurred. Please try again.',
    serverUnreachableTitle: 'Server unreachable',
    serverUnreachableBody:
        'Unable to reach the server. Please check your connection and ensure the backend is running.',
    failedAddToCart: 'Failed to add item to cart',

    /** Search.noResults */
    noResults: 'No results found',
} as const;
