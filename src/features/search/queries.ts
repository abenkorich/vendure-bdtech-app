import {useQuery, keepPreviousData, type UseQueryResult} from '@tanstack/react-query';
import {query} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import {
    SearchProductsQuery,
    SearchOverlayProductsQuery,
    SearchPriceBoundQuery,
} from '@/lib/vendure/queries';
import type {ProductCardData, SearchFacetValue, SearchOverlayResultData} from '@/lib/types';
import {buildSearchInput, type SearchParams} from '@/lib/search-input';

/**
 * Search hooks.
 *
 * `SearchInput` has no price filter on this backend, so the price slider's
 * bounds come from two `take: 1` queries sorted in each direction. That is
 * exact and cheap; deriving bounds from a page of results would silently give
 * the wrong maximum as soon as the result set exceeded one page.
 */

export interface SearchResult {
    products: ProductCardData[];
    facetValues: SearchFacetValue[];
    totalItems: number;
}

export function useSearch(params: SearchParams = {}): UseQueryResult<SearchResult, Error> {
    const hasCriteria = Boolean(params.term || params.collectionSlug);

    return useQuery({
        queryKey: queryKeys.search(params as Record<string, unknown>),
        // An empty term would return the whole 3,200-product catalogue by
        // relevance, which is neither useful nor cheap on mobile data.
        enabled: hasCriteria,
        placeholderData: keepPreviousData,
        queryFn: async ({signal}) => {
            const {data} = await query(SearchProductsQuery, {input: buildSearchInput(params)}, {signal});
            return {
                products: data.search.items,
                facetValues: data.search.facetValues,
                totalItems: data.search.totalItems,
            };
        },
    });
}

/**
 * Type-ahead results for the search overlay.
 *
 * Debouncing belongs to the screen (it owns the input); this hook only refuses
 * to fire on a term too short to be meaningful.
 */
export function useSearchOverlay(
    term: string,
    take = 6,
): UseQueryResult<SearchOverlayResultData[], Error> {
    return useQuery({
        queryKey: queryKeys.searchOverlay(`${term}:${take}`),
        enabled: term.trim().length >= 2,
        placeholderData: keepPreviousData,
        staleTime: 60 * 1000,
        queryFn: async ({signal}) => {
            const {data} = await query(
                SearchOverlayProductsQuery,
                {input: {term: term.trim(), take, groupByProduct: true}},
                {signal},
            );
            return data.search.items;
        },
    });
}

export interface PriceBounds {
    /** Integer minor units. */
    min: number;
    max: number;
}

function boundOf(
    item: {priceWithTax: {__typename: string; min?: number; max?: number; value?: number}} | undefined,
    edge: 'min' | 'max',
): number | undefined {
    const price = item?.priceWithTax;
    if (!price) return undefined;
    if (price.__typename === 'SinglePrice') return price.value;
    return edge === 'min' ? price.min : price.max;
}

/** Price slider bounds for a search/collection context, in minor units. */
export function usePriceBounds(params: SearchParams = {}): UseQueryResult<PriceBounds | null, Error> {
    return useQuery({
        queryKey: queryKeys.priceBounds(params as Record<string, unknown>),
        queryFn: async ({signal}) => {
            const base = {...params, take: 1, skip: 0};
            const [low, high] = await Promise.all([
                query(
                    SearchPriceBoundQuery,
                    {input: buildSearchInput({...base, sort: 'price-asc'})},
                    {signal},
                ),
                query(
                    SearchPriceBoundQuery,
                    {input: buildSearchInput({...base, sort: 'price-desc'})},
                    {signal},
                ),
            ]);

            const min = boundOf(low.data.search.items[0] as never, 'min');
            const max = boundOf(high.data.search.items[0] as never, 'max');
            if (min === undefined || max === undefined) return null;
            return {min, max};
        },
        staleTime: 30 * 60 * 1000,
    });
}

export {buildSearchInput};
export type {SearchFacetValue, SearchOverlayResultData, SearchParams};
