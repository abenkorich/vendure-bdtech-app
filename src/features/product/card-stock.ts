import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {query} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import {CardStockQuery} from '@/lib/vendure/card-stock';
import {preferredStockQuantity} from '@/lib/product-card-extras';

/**
 * Fills in the stock count on cards that came from a search.
 *
 * The search index reports only whether a product is buyable, so a card built
 * from it has a SKU and no number. This asks for the counts of exactly the
 * products on screen, in one request, and merges them in. Cards that already
 * carry a count — the home rails, built from `products` — are left alone and
 * do not contribute to the request; when every card is already answered, no
 * request is made at all.
 */

export interface StockableCard {
    productId: string;
    stockQuantity?: number | null;
}

/** Counts keyed by product id. A plain object, so it survives the MMKV cache. */
type StockByProduct = Record<string, number | null>;

export function useCardsWithStock<T extends StockableCard>(cards: readonly T[]): readonly T[] {
    const missingIds = useMemo(() => {
        const ids = new Set<string>();
        for (const card of cards) {
            if (typeof card.stockQuantity !== 'number') ids.add(card.productId);
        }
        // Sorted so the same set of products is one cache entry however the
        // screen happened to order them.
        return [...ids].sort();
    }, [cards]);

    const {data} = useQuery({
        queryKey: queryKeys.cardStock(missingIds),
        enabled: missingIds.length > 0,
        // Stock moves, but not so fast that a shopper scrolling a grid needs
        // it re-fetched; the product page is the place that must be current.
        staleTime: 5 * 60 * 1000,
        queryFn: async ({signal}): Promise<StockByProduct> => {
            const {data: result} = await query(
                CardStockQuery,
                {options: {filter: {id: {in: [...missingIds]}}, take: missingIds.length}},
                {signal},
            );

            const byProduct: StockByProduct = {};
            for (const product of result.products.items) {
                byProduct[product.id] = preferredStockQuantity(product.variants);
            }
            return byProduct;
        },
    });

    return useMemo(() => {
        if (!data) return cards;
        return cards.map(card =>
            typeof card.stockQuantity === 'number'
                ? card
                : {...card, stockQuantity: data[card.productId] ?? null},
        );
    }, [cards, data]);
}
