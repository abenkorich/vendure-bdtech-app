import {translate} from '@/i18n/translate';
import {getLocale} from '@/i18n';

/**
 * Catalogue copy, resolved from the shipped translation catalogs.
 *
 * This started as a table of English literals: the feature work landed before
 * `useTranslations` existed, so each entry carried the real key path in a
 * comment and a TODO to swap the lookup. That swap is this file.
 *
 * Reads are lazy via a getter, deliberately. Resolving at module load would
 * freeze every string at whatever locale was active on first import, and the
 * language switcher would then translate the tab bar but leave the whole
 * catalogue in the previous language. A getter re-reads on each access, so a
 * re-render after a locale change picks up the new value.
 *
 * `S` is for module scope and non-component code. Inside a component prefer
 * `useTranslations('Namespace')`, which subscribes to locale changes and
 * therefore triggers the re-render this relies on.
 */

/** key -> message path in `messages/*.json`. */
const PATHS = {
    viewAll: 'HomeSections.viewAll',

    newArrivalsEyebrow: 'HomeSections.newArrivals.eyebrow',
    newArrivalsTitle: 'HomeSections.newArrivals.title',

    dealsTitle: 'Merchandising.dealsTitle',
    dealsSubtitle: 'Merchandising.dealsSubtitle',

    categoriesEyebrow: 'HomeSections.categories.eyebrow',
    categoriesTitle: 'HomeSections.categories.title',

    blogEyebrow: 'HomeSections.blog.eyebrow',
    blogTitle: 'HomeSections.blog.title',
    blogMinRead: 'HomeSections.blog.minRead',

    collectionsTitle: 'Collections.pageTitle',
    collectionsEmpty: 'Collections.empty',
    subCollections: 'Collections.subCollections',
    viewCollection: 'Collections.viewCollection',

    sortPlaceholder: 'Sort.placeholder',
    sortNameAsc: 'Sort.nameAsc',
    sortNameDesc: 'Sort.nameDesc',
    sortPriceAsc: 'Sort.priceAsc',
    sortPriceDesc: 'Sort.priceDesc',

    inStock: 'Product.inStock',
    outOfStock: 'Product.outOfStock',
    lowStock: 'Product.lowStock',
    addToCart: 'Product.addToCart',
    adding: 'Product.adding',
    addedToCart: 'Product.addedToCart',
    selectOptions: 'Product.selectOptions',
    descriptionTitle: 'Product.descriptionTitle',
    relatedProducts: 'Product.relatedProducts',
    relatedEyebrow: 'Product.relatedEyebrow',
    from: 'Product.from',

    sku: 'Common.sku',
    loading: 'Common.loading',

    somethingWentWrong: 'Errors.somethingWentWrong',
    tryAgain: 'Errors.tryAgain',
    unexpectedError: 'Errors.unexpectedError',
    serverUnreachableTitle: 'Errors.serverUnreachableTitle',
    serverUnreachableBody: 'Errors.serverUnreachableBody',
    failedAddToCart: 'Errors.failedAddToCart',

    noResults: 'Search.noResults',
} as const;

export type CatalogueStringKey = keyof typeof PATHS;

/**
 * Every key resolves through the active locale on access. `translate` splits
 * the path itself, so the namespace argument is empty.
 */
export const S = Object.defineProperties(
    {} as Record<CatalogueStringKey, string>,
    Object.fromEntries(
        Object.entries(PATHS).map(([key, path]) => [
            key,
            {get: () => translate(getLocale(), '', path), enumerable: true},
        ]),
    ),
);

/**
 * One-off lookup by full message path, for a string that has a key but no
 * entry in the table above (a spec-sheet row label, say). Resolves through the
 * active locale on every call, same as `S`.
 */
export function tr(path: string): string {
    return translate(getLocale(), '', path);
}
