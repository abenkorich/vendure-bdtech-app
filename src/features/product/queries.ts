import {useQuery, type UseQueryResult} from '@tanstack/react-query';
import {query} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import {GetProductDetailQuery} from '@/lib/vendure/queries';
import type {ProductDetail} from '@/lib/types';

/**
 * Product detail.
 *
 * Catalogue data, so it is persisted to MMKV and a returning visitor sees a
 * previously-viewed product instantly. Prices are re-validated in the
 * background on every mount — a stale price is the one field that must not be
 * allowed to sit.
 */
export function useProduct(
    slug: string | undefined,
): UseQueryResult<ProductDetail | null, Error> {
    return useQuery({
        queryKey: queryKeys.product(slug ?? ''),
        // A route param can be undefined for a frame during navigation;
        // querying with an empty slug would cache a null under a junk key.
        enabled: Boolean(slug),
        queryFn: async ({signal}) => {
            const {data} = await query(GetProductDetailQuery, {slug: slug as string}, {signal});
            return data.product ?? null;
        },
    });
}

export type {ProductDetail};
