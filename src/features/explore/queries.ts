import {useInfiniteQuery, type UseInfiniteQueryResult, type InfiniteData} from '@tanstack/react-query';
import {query} from '@/lib/vendure/api';
import {SearchProductsQuery} from '@/lib/vendure/queries';
import {queryKeys} from '@/lib/query-keys';
import {readProductCards} from '@/lib/types';
import {
    FEED_MAX_COLLECTIONS,
    hasMorePages,
    interleave,
    pageWindows,
    perCollection,
} from './feed-core';

/**
 * The "Explore more" feed: a paged, newest-first mix of products from a few
 * collections, either the ones this device browsed or the merchant's
 * highlighted ones. See `feed-core.ts` for the paging rule.
 */

interface FeedTotals {
    slug: string;
    total: number;
}

interface FeedPageParam {
    index: number;
    /** Learned on the first page, carried so later pages need no extra call. */
    totals?: FeedTotals[];
}

/** Unmasked cards, so pages can be de-duplicated by product id. */
export type FeedCard = ReturnType<typeof readProductCards>[number];

export interface FeedPage {
    products: FeedCard[];
    totals: FeedTotals[];
    index: number;
}

async function readTotals(slugs: readonly string[], signal?: AbortSignal): Promise<FeedTotals[]> {
    const results = await Promise.all(
        slugs.map(async slug => {
            try {
                const {data} = await query(
                    SearchProductsQuery,
                    {input: {collectionSlug: slug, take: 1, groupByProduct: true}},
                    {signal},
                );
                return {slug, total: data.search.totalItems};
            } catch {
                // One unreachable collection must not sink the feed.
                return {slug, total: 0};
            }
        }),
    );
    return results.filter(entry => entry.total > 0);
}

export function useExploreFeed(
    slugs: readonly string[],
): UseInfiniteQueryResult<InfiniteData<FeedPage>, Error> {
    const chosen = slugs.slice(0, FEED_MAX_COLLECTIONS);

    return useInfiniteQuery({
        queryKey: queryKeys.exploreFeed(chosen),
        enabled: chosen.length > 0,
        initialPageParam: {index: 0} as FeedPageParam,
        queryFn: async ({pageParam, signal}): Promise<FeedPage> => {
            const totals = pageParam.totals ?? (await readTotals(chosen, signal));
            const per = perCollection(totals.length);
            const windows = pageWindows(totals, pageParam.index, per);

            const lists = await Promise.all(
                windows.map(async window => {
                    try {
                        const {data} = await query(
                            SearchProductsQuery,
                            {
                                input: {
                                    collectionSlug: window.slug,
                                    skip: window.skip,
                                    take: window.take,
                                    groupByProduct: true,
                                },
                            },
                            {signal},
                        );
                        // The index answers oldest first; the feed reads newest first.
                        return [...readProductCards(data.search.items)].reverse();
                    } catch {
                        return [];
                    }
                }),
            );

            return {
                products: interleave(lists, item => item.productId),
                totals,
                index: pageParam.index,
            };
        },
        getNextPageParam: (last): FeedPageParam | undefined => {
            const per = perCollection(last.totals.length);
            return hasMorePages(last.totals, last.index, per)
                ? {index: last.index + 1, totals: last.totals}
                : undefined;
        },
        // New products arrive on the order of days; a stale feed for a few
        // minutes is invisible, a refetch on every focus is not.
        staleTime: 10 * 60 * 1000,
    });
}
