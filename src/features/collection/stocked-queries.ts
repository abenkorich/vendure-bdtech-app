import {useQuery, type UseQueryResult} from '@tanstack/react-query';
import {query} from '@/lib/vendure/api';
import {SearchProductsQuery} from '@/lib/vendure/queries';
import {queryKeys} from '@/lib/query-keys';
import type {ProductCardData} from '@/lib/types';

/**
 * Collections that actually have products, with a sample of each.
 *
 * Built around a fact about this catalogue rather than an assumption: the
 * top-level collections are **empty containers**. Stock lives in their
 * children, and only 11 of 45 children hold any (measured against the live
 * API; two whole top-level categories have zero products anywhere beneath
 * them).
 *
 * So a naive "rail per collection" would render mostly empty rails. This asks
 * the search index once per candidate and reports only the ones worth showing,
 * which is what lets the shop screen stay lively instead of displaying a
 * column of blank sections.
 *
 * One request per candidate is acceptable because the candidate list is the
 * merchant's handful of highlighted collections, they run in parallel, and the
 * result is cached for the session.
 */

export interface StockedCollection {
    slug: string;
    name: string;
    /** The parent category, shown as the rail's eyebrow. */
    parentName?: string;
    totalItems: number;
    products: readonly ProductCardData[];
}

/** Product totals per collection slug, for callers that only need the count. */
export type CollectionTotals = Readonly<Record<string, number>>;

export interface StockedCollectionsResult {
    /** Collections worth a rail, best-stocked first. */
    rails: StockedCollection[];
    /** Product totals for every candidate, including the empty ones. */
    totals: CollectionTotals;
}

export interface StockedCollectionsParams {
    /** Candidate collections, usually the children of the browsed tree. */
    candidates: readonly {slug: string; name: string; parentName?: string}[];
    /** Products to sample per collection. */
    take?: number;
    /** How many stocked collections to keep, best-stocked first. */
    limit?: number;
}

export function useStockedCollections({
    candidates,
    take = 8,
    limit = 4,
}: StockedCollectionsParams): UseQueryResult<StockedCollectionsResult, Error> {
    const slugs = candidates.map(candidate => candidate.slug);

    return useQuery({
        queryKey: queryKeys.stockedCollections(slugs, take, limit),
        enabled: candidates.length > 0,
        // Which collections carry stock changes with the catalogue, not with
        // the session, so this is worth holding on to.
        staleTime: 10 * 60 * 1000,
        queryFn: async ({signal}): Promise<StockedCollectionsResult> => {
            const results: Array<StockedCollection | null> = await Promise.all(
                candidates.map(async candidate => {
                    try {
                        const {data} = await query(
                            SearchProductsQuery,
                            {
                                input: {
                                    collectionSlug: candidate.slug,
                                    take,
                                    groupByProduct: true,
                                },
                            },
                            {signal},
                        );

                        const entry: StockedCollection = {
                            slug: candidate.slug,
                            name: candidate.name,
                            parentName: candidate.parentName,
                            totalItems: data.search.totalItems,
                            products: data.search.items,
                        };
                        return entry;
                    } catch {
                        // One failed collection must not blank the whole
                        // screen; it simply does not get a rail.
                        return null;
                    }
                }),
            );

            const found = results.filter(
                (result): result is StockedCollection => result !== null,
            );

            // Totals include zeroes, so a caller can label a category honestly
            // ("no products yet") rather than implying stock that is not there.
            const totals: Record<string, number> = {};
            for (const entry of found) totals[entry.slug] = entry.totalItems;

            return {
                rails: found
                    .filter(result => result.totalItems > 0)
                    .sort((a, b) => b.totalItems - a.totalItems)
                    .slice(0, limit),
                totals,
            };
        },
    });
}
