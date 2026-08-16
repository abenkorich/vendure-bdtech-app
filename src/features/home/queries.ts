import {useQuery, type UseQueryResult} from '@tanstack/react-query';
import {query} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
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
