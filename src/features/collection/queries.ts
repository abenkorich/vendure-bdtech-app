import {useQuery, keepPreviousData, type UseQueryResult} from '@tanstack/react-query';
import {query} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import {
    GetCollectionProductsQuery,
    GetTopCollectionsQuery,
    GetAllCollectionsFlatQuery,
} from '@/lib/vendure/queries';
import type {ResultOf} from '@/graphql';
import type {CollectionDetail, CollectionTreeNode, ProductCardData} from '@/lib/types';
import {buildCollectionSearchInput, type SearchParams} from '@/lib/search-input';

/**
 * Collection hooks.
 *
 * A collection page is one document: the collection itself plus a `search`
 * scoped to it. Splitting them would show a header and an empty grid while the
 * second request lands, so they stay together as the storefront wrote them.
 */

/** Collection listing params. Same shape as search, minus the collection. */
export type CollectionParams = Omit<SearchParams, 'collectionSlug'>;

export interface CollectionResult {
    collection: CollectionDetail | null;
    products: ProductCardData[];
    totalItems: number;
}

export function useCollection(
    slug: string | undefined,
    params: CollectionParams = {},
): UseQueryResult<CollectionResult, Error> {
    return useQuery({
        queryKey: queryKeys.collection(slug ?? '', params as Record<string, unknown>),
        enabled: Boolean(slug),
        // Paging and filtering should redraw the grid in place rather than
        // collapsing it to a skeleton on every tap of a filter chip.
        placeholderData: keepPreviousData,
        queryFn: async ({signal}) => {
            const {data} = await query(
                GetCollectionProductsQuery,
                {slug: slug as string, input: buildCollectionSearchInput(slug as string, params)},
                {signal},
            );
            return {
                collection: data.collection ?? null,
                products: data.search.items,
                totalItems: data.search.totalItems,
            };
        },
    });
}

/** The nested top-level collection tree, for the shop tab and category grids. */
export function useCollections(): UseQueryResult<CollectionTreeNode[], Error> {
    return useQuery({
        queryKey: queryKeys.collections(),
        queryFn: async ({signal}) => {
            const {data} = await query(GetTopCollectionsQuery, {}, {signal});
            return data.collections.items;
        },
        // The category tree changes on the order of weeks, not minutes.
        staleTime: 60 * 60 * 1000,
    });
}

export type FlatCollection = ResultOf<
    typeof GetAllCollectionsFlatQuery
>['collections']['items'][number];

/**
 * Every collection, flat. GraphQL nesting cannot express arbitrary depth, so
 * anything walking the full tree (pickers, breadcrumb building) uses this.
 */
export function useCollectionsFlat(take = 500): UseQueryResult<FlatCollection[], Error> {
    return useQuery({
        queryKey: queryKeys.collectionsFlat({take}),
        queryFn: async ({signal}) => {
            const {data} = await query(GetAllCollectionsFlatQuery, {options: {take}}, {signal});
            return data.collections.items;
        },
        staleTime: 60 * 60 * 1000,
    });
}

export {buildCollectionSearchInput};
export type {CollectionDetail, CollectionTreeNode};
