import {useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';
import {query} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import type {ResultOf} from '@/graphql';
import {
    HasMemberProductDiscountsQuery,
    MemberProductDiscountsQuery,
    MEMBER_DISCOUNTS_MAX_PRODUCTS,
} from '@/lib/vendure/product-discounts';
import {createBatchLoader} from '@/lib/batch-loader';
import {useSession} from '@/features/auth/queries';

/**
 * Member prices, laid over catalogue prices for a signed-in shopper.
 *
 * Catalogue queries are anonymous by design — identical for everyone, cached,
 * persisted to MMKV — so the sale prices they carry are the ones open to
 * everyone. A shopper in a customer group can be entitled to more, and should
 * see it on the card and the product page, not first in the cart.
 *
 * - Signed in only: a guest's session token has no customer groups. And only
 *   once `hasMemberProductDiscounts` says a live discount is reserved for one
 *   of this shopper's groups; every other shopper costs that one query.
 * - Keys sit under the customer root, so they are never persisted (the
 *   persister whitelists `catalogue`) and are reset on every token change by
 *   `auth-cache-sync`; the customer id is part of the key besides.
 * - One cache entry per product, filled through a batch loader: a grid of 24
 *   cards is one request, and a product answered on the home screen is not
 *   asked for again on the collection screen.
 */

export type MemberProductOverlay = ResultOf<
    typeof MemberProductDiscountsQuery
>['productDiscountsForProducts'][number];

/** Keyed by product id. A plain object, so TanStack can share it structurally. */
export type MemberProductOverlays = Readonly<Record<string, MemberProductOverlay>>;

const STALE_MS = 5 * 60 * 1000;

const overlayLoader = createBatchLoader<MemberProductOverlay>(
    async productIds => {
        // No abort signal: the request is shared by every card that asked in
        // the same frame, and one card scrolling away must not cancel it.
        const {data} = await query(
            MemberProductDiscountsQuery,
            {productIds: [...productIds]},
            {useAuthToken: true},
        );
        return new Map(
            data.productDiscountsForProducts.map(overlay => [String(overlay.productId), overlay]),
        );
    },
    {maxBatchSize: MEMBER_DISCOUNTS_MAX_PRODUCTS, delayMs: 16},
);

export interface MemberPricing {
    customerId: string | null;
    /** A live discount is reserved for one of the signed-in shopper's groups. */
    enabled: boolean;
}

export function useMemberPricing(): MemberPricing {
    const {customer} = useSession();
    const customerId = customer?.id ?? null;

    const {data} = useQuery({
        queryKey: queryKeys.hasMemberDiscounts(customerId ?? ''),
        enabled: customerId !== null,
        staleTime: STALE_MS,
        queryFn: async ({signal}) => {
            const {data: result} = await query(
                HasMemberProductDiscountsQuery,
                {},
                {useAuthToken: true, signal},
            );
            return result.hasMemberProductDiscounts;
        },
    });

    return {customerId, enabled: customerId !== null && data === true};
}

function combineOverlays(
    results: readonly {data?: MemberProductOverlay | null}[],
): MemberProductOverlays {
    const overlays: Record<string, MemberProductOverlay> = {};
    for (const result of results) {
        if (result.data) overlays[String(result.data.productId)] = result.data;
    }
    return overlays;
}

/** Member discounts for these products; empty for everyone without any. */
export function useMemberProductOverlays(productIds: readonly string[]): MemberProductOverlays {
    const {customerId, enabled} = useMemberPricing();
    const ids = useMemo(() => [...new Set(productIds)], [productIds]);

    return useQueries({
        queries:
            enabled && customerId !== null
                ? ids.map(productId => ({
                      queryKey: queryKeys.memberProductDiscounts(customerId, productId),
                      staleTime: STALE_MS,
                      queryFn: () => overlayLoader.load(productId),
                  }))
                : [],
        combine: combineOverlays,
    });
}

/**
 * Cards with the signed-in shopper's own sale summary in place of the public
 * one. Cards the overlay has not answered for are returned as they are.
 */
export function useCardsWithMemberPrices<T extends {productId: string; discount?: unknown}>(
    cards: readonly T[],
): readonly T[] {
    const productIds = useMemo(() => cards.map(card => card.productId), [cards]);
    const overlays = useMemberProductOverlays(productIds);

    return useMemo(() => {
        if (Object.keys(overlays).length === 0) return cards;
        return cards.map(card => {
            const overlay = overlays[String(card.productId)];
            return overlay ? ({...card, discount: overlay.discount} as T) : card;
        });
    }, [cards, overlays]);
}
