import {useQuery, type UseQueryResult} from '@tanstack/react-query';
import {query} from '@/lib/vendure/api';
import {SearchProductsQuery} from '@/lib/vendure/queries';
import {queryKeys} from '@/lib/query-keys';
import type {ProductCardData} from '@/lib/types';

/**
 * Collections that actually have products, with a sample of each.
 *
 * Built around measurement rather than assumption, and re-measured because
 * the catalogue moves. When this was written, top-level collections were
 * empty containers and only 11 of 45 children held stock. By 2026-09-05 most
 * children were stocked, one whole top-level category still had nothing
 * beneath it, and 4 of 7 parents held products directly (Fabrication &
 * Prototyping: 209 of its own, more than all its children combined).
 *
 * So a naive "rail per collection" would still render empty rails for the
 * dead branches. This asks the search index once per candidate and reports
 * only the ones worth showing, which is what lets the shop screen stay lively
 * instead of displaying a column of blank sections.
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
    /**
     * Collections to count.
     *
     * A candidate with no `parentName` is a top-level category: it is counted
     * (its subtitle needs the number) but never turned into a rail. The card
     * above already opens the parent, and the four best-stocked children
     * out-rank every parent's own count, so a parent rail would only repeat
     * what is a tap away.
     */
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
                    // Children only; see `candidates`.
                    .filter(result => result.parentName !== undefined)
                    .sort((a, b) => b.totalItems - a.totalItems)
                    .slice(0, limit),
                totals,
            };
        },
    });
}
