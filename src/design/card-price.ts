import {discountPercent} from '@/design/format-price';

/**
 * What a product card shows for its price, sale included.
 *
 * Beside `format-price` rather than in `src/lib` because the design system
 * renders it and must not depend on the data layer, and free of React Native
 * so the rules are unit-tested (`tests/product-discounts.test.ts`). The shapes
 * are structural: the `ProductCard` fragment satisfies them without a cast.
 *
 * Every amount is integer minor units, tax included.
 */

export type CardPriceLike =
    | {__typename?: 'SinglePrice'; value: number}
    | {__typename?: 'PriceRange'; min: number; max: number};

/** `SearchResult.discount`, as much of it as a card uses. */
export interface CardDiscountLike {
    fromPriceWithTax: number;
    fromOriginalPriceWithTax: number;
    maxPercentOff: number;
    membersOnly: boolean;
    quantityDiscount?: {minQuantity: number; percentOff: number} | null;
}

export interface CardPriceDisplay {
    /** The number in the price slot: the sale price when there is one. */
    value: number;
    /** The real price of that same variant, struck through; null when not on sale. */
    compareAt: number | null;
    /** The product has several prices, so the value reads "from". */
    isRange: boolean;
    /** The biggest saving across the product's variants; null without a sale. */
    percentOff: number | null;
    /**
     * The priced variant saves less than `percentOff` (or nothing): the badge
     * must say "up to", or it claims a saving the shown price does not have.
     */
    upTo: boolean;
    membersOnly: boolean;
    /** A better price from a minimum quantity, shown as a hint, never struck. */
    quantityDiscount: {minQuantity: number; percentOff: number} | null;
}

export function cardPriceDisplay(card: {
    priceWithTax: CardPriceLike;
    discount?: CardDiscountLike | null;
}): CardPriceDisplay {
    const price = card.priceWithTax;
    const isRange = 'min' in price && 'max' in price && price.min !== price.max;
    const regular = 'value' in price ? price.value : price.min;
    const discount = card.discount ?? null;

    // A summary with no single-unit saving carries only quantity tiers, which
    // the API documents as hints rather than a crossed-out price.
    if (!discount || discount.maxPercentOff <= 0) {
        return {
            value: regular,
            compareAt: null,
            isRange,
            percentOff: null,
            upTo: false,
            membersOnly: discount?.membersOnly ?? false,
            quantityDiscount: discount?.quantityDiscount ?? null,
        };
    }

    // The server picks the variant cheapest *after* discounts and strikes that
    // same variant's real price, so the pair is always one variant's.
    const fromPercent = discountPercent(discount.fromOriginalPriceWithTax, discount.fromPriceWithTax);

    return {
        value: discount.fromPriceWithTax,
        compareAt: fromPercent !== null ? discount.fromOriginalPriceWithTax : null,
        isRange,
        percentOff: discount.maxPercentOff,
        upTo: fromPercent !== discount.maxPercentOff,
        membersOnly: discount.membersOnly,
        quantityDiscount: discount.quantityDiscount ?? null,
    };
}

/** Whether the card renders a struck-through price (and so a second price line). */
export function hasStruckPrice(card: {
    priceWithTax: CardPriceLike;
    discount?: CardDiscountLike | null;
}): boolean {
    return cardPriceDisplay(card).compareAt !== null;
}
