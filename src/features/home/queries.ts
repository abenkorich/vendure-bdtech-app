import {useQuery, type UseQueryResult} from '@tanstack/react-query';
import {query} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import {GetProductCardBySlugQuery, SearchProductsQuery} from '@/lib/vendure/queries';
import {toProductCardFragment} from '@/lib/vendure/product-card-from-detail';
import {buildCollectionSearchInput} from '@/lib/search-input';
import type {RailSection} from '@/lib/site-config/schema';
import {
    DealProductsRailQuery,
    NewArrivalsRailQuery,
    dealsOptions,
    newArrivalsOptions,
    railItemsToCards,
    type DealProductsRailResult,
    type NewArrivalsRailResult,
} from '@/lib/vendure/rails';
import type {ProductCardData} from '@/lib/types';

/**
 * Home-screen rails.
 *
 * Both return `ProductCardData[]`, the same fragment the search grid renders,
 * so one `ProductCard` component serves every surface in the app.
 *
 * See `lib/vendure/rails.ts` for why these documents exist alongside the
 * copied `merchandising.ts`: this backend predates the merchandising plugin,
 * `dealProducts` takes `ProductListOptions`, and `newArrivalProducts` cannot be
 * called at all.
 */

export interface RailResult {
    products: ProductCardData[];
    totalItems: number;
}

/**
 * Deal products.
 *
 * Verified live: this resolver currently answers `totalItems: 0` because
 * nothing in the catalogue is flagged as a deal yet. The rail should render
 * nothing rather than an error, and screens should treat an empty rail as a
 * normal state.
 */
export function useDeals(take = 12): UseQueryResult<RailResult, Error> {
    return useQuery({
        queryKey: queryKeys.deals({take}),
        queryFn: async ({signal}) => {
            const {data} = await query(
                DealProductsRailQuery,
                {options: dealsOptions(take)},
                {signal},
            );
            const result = data as DealProductsRailResult;
            return {
                products: railItemsToCards(result.dealProducts.items),
                totalItems: result.dealProducts.totalItems,
            };
        },
        staleTime: 15 * 60 * 1000,
    });
}

/** Newest products first. Backed by `products`, not `newArrivalProducts`. */
export function useNewArrivals(take = 12): UseQueryResult<RailResult, Error> {
    return useQuery({
        queryKey: queryKeys.newArrivals({take}),
        queryFn: async ({signal}) => {
            const {data} = await query(
                NewArrivalsRailQuery,
                {options: newArrivalsOptions(take)},
                {signal},
            );
            const result = data as NewArrivalsRailResult;
            return {
                products: railItemsToCards(result.products.items),
                totalItems: result.products.totalItems,
            };
        },
        staleTime: 15 * 60 * 1000,
    });
}

/**
 * A merchant-configured rail from the customizer's Mobile app pane.
 *
 * One hook for every source, so the home screen can render a list of rails
 * without knowing which is which: `newArrivals` and `deals` reuse the two
 * documents above, `collection` asks the search index (the same call the
 * collection page makes), and `manual` looks each hand-picked slug up and
 * keeps the merchant's order. A slug that no longer resolves is dropped
 * rather than rendered as a hole.
 */
export function useRailProducts(rail: RailSection): UseQueryResult<RailResult, Error> {
    return useQuery({
        queryKey: queryKeys.appRail(rail as unknown as Record<string, unknown>),
        queryFn: async ({signal}): Promise<RailResult> => {
            switch (rail.source) {
                case 'newArrivals': {
                    const {data} = await query(
                        NewArrivalsRailQuery,
                        {options: newArrivalsOptions(rail.take)},
                        {signal},
                    );
                    const result = data as NewArrivalsRailResult;
                    return {
                        products: railItemsToCards(result.products.items),
                        totalItems: result.products.totalItems,
                    };
                }
                case 'deals': {
                    const {data} = await query(
                        DealProductsRailQuery,
                        {options: dealsOptions(rail.take)},
                        {signal},
                    );
                    const result = data as DealProductsRailResult;
                    return {
                        products: railItemsToCards(result.dealProducts.items),
                        totalItems: result.dealProducts.totalItems,
                    };
                }
                case 'collection': {
                    const slug = rail.collectionSlug?.trim();
                    if (!slug) return {products: [], totalItems: 0};
                    const {data} = await query(
                        SearchProductsQuery,
                        {
                            input: buildCollectionSearchInput(slug, {
                                take: rail.take,
                                sort: rail.sort === 'default' ? undefined : rail.sort,
                            }),
                        },
                        {signal},
                    );
                    return {products: data.search.items, totalItems: data.search.totalItems};
                }
                case 'manual': {
                    const slugs = rail.productSlugs.slice(0, rail.take);
                    const found = await Promise.all(
                        slugs.map(async slug => {
                            try {
                                const {data} = await query(GetProductCardBySlugQuery, {slug}, {signal});
                                return data.product ?? null;
                            } catch {
                                return null;
                            }
                        }),
                    );
                    const products = found
                        .filter(
                            (product): product is NonNullable<typeof product> =>
                                product !== null && product.variants.length > 0,
                        )
                        .map(product => toProductCardFragment(product, 'DZD'));
                    return {products, totalItems: products.length};
                }
            }
        },
        staleTime: 15 * 60 * 1000,
    });
}
