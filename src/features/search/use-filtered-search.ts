import {useMemo} from 'react';
import {useSearch, type SearchResult} from './queries';
import {readProductCards} from '@/lib/types';
import type {ProductCardData} from '@/lib/types';
import {matchesPriceFilter} from '@/lib/price-filter';
import {priceFilterOf, sortParam, type FilterState} from './filter-state';

/**
 * The screen's single data entry point: `useSearch` plus the two things the
 * backend cannot do for us.
 *
 * 1. **Price.** Vendure's `SearchInput` has no price filter (see the header of
 *    `lib/price-filter.ts`), so a selected price window is applied in memory.
 *    When one is active the query switches to an unpaginated fetch and this
 *    hook slices the page itself; when none is, the normal paginated path is
 *    used untouched, so the common case costs nothing.
 * 2. **Unmasking.** `ProductCardData` is a masked gql.tada fragment and cannot
 *    be handed to `<ProductCard>` directly. Doing it here means the screen
 *    never touches the GraphQL layer.
 */

/** Matches the 2-column grid: 12 rows per page. */
export const PAGE_SIZE = 24;

/**
 * Ceiling for the in-memory price pass. The catalogue is ~3.2k products and a
 * term always narrows it further, so this is a safety valve, not a page size.
 */
const UNPAGINATED_TAKE = 500;

export type SearchCard = ReturnType<typeof readProductCards>[number];

export interface FilteredSearch {
    products: readonly SearchCard[];
    facetValues: SearchResult['facetValues'];
    totalItems: number;
    /** True while the *first* results for a term are loading (no stale page). */
    isInitialLoading: boolean;
    /** True while a newer result set is in flight behind a stale one. */
    isRefreshing: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => void;
    /** False when the term is too short/absent — the start state, not empty. */
    isActive: boolean;
    canLoadMore: boolean;
}

export function useFilteredSearch(
    term: string,
    filters: FilterState,
    page: number,
): FilteredSearch {
    const priceFilter = priceFilterOf(filters);
    const trimmed = term.trim();
    const isActive = trimmed.length > 0;

    const query = useSearch({
        ...(isActive ? {term: trimmed} : {}),
        // Everything up to the requested page, not just the page itself: this
        // is an infinite grid, so page 3 must render pages 1–3 together.
        take: priceFilter ? UNPAGINATED_TAKE : PAGE_SIZE * page,
        skip: 0,
        ...(sortParam(filters.sort) ? {sort: sortParam(filters.sort)} : {}),
        ...(filters.facetValueIds.length ? {facetValueIds: filters.facetValueIds} : {}),
        ...(filters.inStockOnly ? {inStock: true} : {}),
    });

    const data = query.data;

    const {products, totalItems} = useMemo(() => {
        if (!data) return {products: [] as readonly SearchCard[], totalItems: 0};

        const cards = readProductCards(data.products as readonly ProductCardData[]);
        if (!priceFilter) return {products: cards, totalItems: data.totalItems};

        const matching = cards.filter(card => matchesPriceFilter(card.priceWithTax, priceFilter));
        return {
            products: matching.slice(0, PAGE_SIZE * page),
            // The filtered count is the honest one to show: "412 results" above
            // a grid the user has narrowed to 9 is worse than no count at all.
            totalItems: matching.length,
        };
    }, [data, priceFilter?.min, priceFilter?.max, page]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        products,
        facetValues: data?.facetValues ?? [],
        totalItems,
        // `placeholderData: keepPreviousData` means `isLoading` stays false once
        // any result exists, so "no data yet" is the condition for skeletons.
        isInitialLoading: isActive && query.isFetching && !data,
        isRefreshing: query.isFetching && Boolean(data),
        isError: query.isError,
        error: query.error ?? null,
        refetch: query.refetch,
        isActive,
        canLoadMore: products.length < totalItems,
    };
}
