import {query} from '@/lib/vendure/api';
import {SearchProductsQuery, SearchPriceBoundQuery} from '@/lib/vendure/queries';
import type {SearchInputParams, PriceFilter} from '@/lib/search-helpers';

/**
 * Price support for the collection/search filter pane.
 *
 * Vendure's `SearchInput` exposes `inStock` but **no price filter**, so the
 * price window cannot be pushed down to the search index. Everything here works
 * around that:
 *
 *  - `getPriceBounds` derives the slider's endpoints from two `take: 1` queries
 *    sorted by price ascending/descending. That is exact and costs two tiny
 *    round trips, versus fetching every result to compute a min/max.
 *  - `searchWithPriceFilter` only departs from the normal paginated query when a
 *    price window is actually selected. In that case it re-runs the same search
 *    unpaginated, filters in memory, and slices the requested page. The catalogue
 *    is ~3.2k products (~1.3 MB, ~1.4 s uncached) and the largest collection is
 *    50, so this stays affordable, and the callers wrap it in the same cached
 *    helpers as the normal path.
 */

/** Upper bound for the "fetch everything then filter" pass. */
const UNPAGINATED_TAKE = 5000;

/**
 * `PriceRange | SinglePrice` flattened into one optional shape. A discriminated
 * union would be more precise, but the generated gql-tada types already model
 * that and callers only ever need the numeric span, so this stays structural.
 */
type PriceValue = {min?: number; max?: number; value?: number; __typename?: string};

/** Lowest price a result can be bought at, in minor units. */
export function lowestPrice(price: PriceValue): number {
    if (typeof price?.min === 'number') return price.min;
    return typeof price?.value === 'number' ? price.value : 0;
}

/** Highest price a result can be bought at, in minor units. */
export function highestPrice(price: PriceValue): number {
    if (typeof price?.max === 'number') return price.max;
    return typeof price?.value === 'number' ? price.value : 0;
}

/**
 * A product matches when its price span overlaps the selected window, so a
 * variant-priced product stays visible if *any* variant falls inside it.
 */
export function matchesPriceFilter(price: PriceValue, filter: PriceFilter): boolean {
    const min = filter.min ?? Number.NEGATIVE_INFINITY;
    const max = filter.max ?? Number.POSITIVE_INFINITY;
    return highestPrice(price) >= min && lowestPrice(price) <= max;
}

export interface PriceBounds {
    min: number;
    max: number;
}

/**
 * Cheapest and priciest price (minor units) across a search scope, ignoring any
 * selected price window so the slider's track never collapses onto its handles.
 */
export async function getPriceBounds(
    input: SearchInputParams,
    options: {languageCode?: string; currencyCode?: string} = {},
): Promise<PriceBounds | null> {
    const base = {...input, take: 1, skip: 0};

    const [low, high] = await Promise.all([
        query(SearchPriceBoundQuery, {input: {...base, sort: {price: 'ASC' as const}}}, options),
        query(SearchPriceBoundQuery, {input: {...base, sort: {price: 'DESC' as const}}}, options),
    ]);

    const lowItem = low.data.search.items[0];
    const highItem = high.data.search.items[0];
    if (!lowItem || !highItem) return null;

    const min = lowestPrice(lowItem.priceWithTax as PriceValue);
    const max = highestPrice(highItem.priceWithTax as PriceValue);
    return max > min ? {min, max} : {min, max: min};
}

type SearchResponse = Awaited<ReturnType<typeof query<any, any>>>;

/**
 * Runs the product search, applying the price window in memory when one is set.
 *
 * `facetValues` are kept as the server returned them: they already reflect the
 * term, collection, facet and stock filters, and recomputing them from the
 * price-filtered page would make counts shrink as the user narrows price,
 * hiding options they can still reach by widening it again.
 */
export async function searchWithPriceFilter(
    input: SearchInputParams,
    priceFilter: PriceFilter | null,
    options: {languageCode?: string; currencyCode?: string} = {},
): Promise<SearchResponse> {
    if (!priceFilter) {
        return query(SearchProductsQuery, {input}, options);
    }

    const {take, skip} = input;
    const result = await query(
        SearchProductsQuery,
        {input: {...input, take: UNPAGINATED_TAKE, skip: 0}},
        options,
    );

    const search = result.data.search;
    const matching = search.items.filter((item: any) =>
        matchesPriceFilter(item.priceWithTax as PriceValue, priceFilter),
    );

    return {
        ...result,
        data: {
            ...result.data,
            search: {
                ...search,
                totalItems: matching.length,
                items: matching.slice(skip, skip + take),
            },
        },
    };
}
