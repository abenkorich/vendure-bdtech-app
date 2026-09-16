/**
 * Product discounts on the catalogue, as the app reads them.
 *
 * Written for the app (not copied from the web storefront). The pricing is the
 * platform's `product-discounts` plugin; this module holds the structural
 * shapes the Shop API returns and the few rules the screens need around them,
 * free of React Native so they run in Node tests.
 *
 * Every amount is integer minor units, tax included.
 */

/** `ProductVariant.discount`: the best discount from a single unit. */
export interface VariantDiscountLike {
    productDiscountId: string;
    name: string;
    priceWithTax: number;
    originalPriceWithTax: number;
    percentOff: number;
    endsAt?: string | null;
    /** Units still sold at this price; null when unlimited. */
    unitsRemaining?: number | null;
    /** Units per order sold at this price; null when unlimited. */
    maxQuantityPerOrder?: number | null;
    membersOnly: boolean;
}

/** `ProductVariant.quantityDiscounts[]`: a better unit price from `minQuantity` units. */
export interface QuantityDiscountLike {
    minQuantity: number;
    productDiscountId: string;
    name: string;
    priceWithTax: number;
    percentOff: number;
    endsAt?: string | null;
    membersOnly: boolean;
}

export interface DiscountedVariantLike {
    priceWithTax: number;
    discount?: VariantDiscountLike | null;
    quantityDiscounts?: readonly QuantityDiscountLike[] | null;
}

/** `SearchResult.discount`, with exactly the fields the `ProductCard` fragment selects. */
export interface CardDiscountSummary {
    productDiscountId: string | null;
    name: string | null;
    fromPriceWithTax: number;
    fromOriginalPriceWithTax: number;
    maxPercentOff: number;
    endsAt: string | null;
    discountedVariantCount: number;
    membersOnly: boolean;
    quantityDiscount: {minQuantity: number; percentOff: number} | null;
}

/**
 * A card's discount summary built from a product's variants.
 *
 * Cards from `search` get `SearchResult.discount` from the server; the home
 * rails are built from `products`, which has variants but no summary. This is
 * the server's `summarize` (plugin `product-discount-catalog.service.ts`)
 * restated, so a product reads the same on a rail as in a search grid:
 *
 * - "from" is the variant cheapest after discounts, struck at its own real
 *   price, and on equal sale prices the lower real price, so the card never
 *   claims the bigger saving;
 * - the headline (name, members-only) is the single-unit discount saving the
 *   most, else the lowest quantity tier;
 * - the end date is the soonest among discounted variants.
 */
export function summarizeVariantDiscounts(
    variants: readonly DiscountedVariantLike[],
): CardDiscountSummary | null {
    const withAnything = variants.filter(
        variant => variant.discount || (variant.quantityDiscounts?.length ?? 0) > 0,
    );
    if (withAnything.length === 0) return null;

    const effective = (variant: DiscountedVariantLike) =>
        variant.discount ? variant.discount.priceWithTax : variant.priceWithTax;
    const cheapest = [...variants].sort(
        (a, b) => effective(a) - effective(b) || a.priceWithTax - b.priceWithTax,
    )[0]!;

    const discounted = variants.filter(variant => variant.discount);
    const top = [...discounted].sort(
        (a, b) => b.discount!.percentOff - a.discount!.percentOff,
    )[0]?.discount;
    const tier = variants
        .flatMap(variant => variant.quantityDiscounts ?? [])
        .sort((a, b) => a.minQuantity - b.minQuantity || b.percentOff - a.percentOff)[0];
    const endsAt =
        discounted
            .map(variant => variant.discount!.endsAt)
            .filter((value): value is string => Boolean(value))
            .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
    const headline = top ?? tier ?? null;

    return {
        productDiscountId: headline?.productDiscountId ?? null,
        name: headline?.name ?? null,
        fromPriceWithTax: effective(cheapest),
        fromOriginalPriceWithTax: cheapest.priceWithTax,
        maxPercentOff: top?.percentOff ?? 0,
        endsAt,
        discountedVariantCount: discounted.length,
        membersOnly: headline?.membersOnly ?? false,
        quantityDiscount: tier ? {minQuantity: tier.minQuantity, percentOff: tier.percentOff} : null,
    };
}

/**
 * Replace variants' discounts with a signed-in shopper's (member prices).
 *
 * Variants the overlay does not mention keep what they had: the overlay is
 * read from the search index, and a variant it lacks is one it cannot price,
 * not one without a discount.
 */
export function withVariantOverlay<
    V extends {id: string; discount?: unknown; quantityDiscounts?: unknown},
>(
    variants: readonly V[],
    overlay:
        | {
              variants: readonly {
                  productVariantId: string;
                  discount: V['discount'];
                  quantityDiscounts: V['quantityDiscounts'];
              }[];
          }
        | null
        | undefined,
): readonly V[] {
    if (!overlay || overlay.variants.length === 0) return variants;
    const byId = new Map(overlay.variants.map(entry => [String(entry.productVariantId), entry]));
    return variants.map(variant => {
        const entry = byId.get(String(variant.id));
        return entry
            ? ({...variant, discount: entry.discount, quantityDiscounts: entry.quantityDiscounts} as V)
            : variant;
    });
}

/** The unit price a quantity buys at: the single-unit sale, or a tier that beats it. */
export function reachedTier<T extends QuantityDiscountLike>(
    variant: {
        priceWithTax: number;
        discount?: VariantDiscountLike | null;
        quantityDiscounts?: readonly T[] | null;
    },
    quantity: number,
): T | null {
    let best: T | null = null;
    let bestPrice = variant.discount?.priceWithTax ?? variant.priceWithTax;
    for (const tier of variant.quantityDiscounts ?? []) {
        if (quantity >= tier.minQuantity && tier.priceWithTax < bestPrice) {
            best = tier;
            bestPrice = tier.priceWithTax;
        }
    }
    return best;
}

/** Within this long of its end a sale shows a countdown rather than a date. */
export const COUNTDOWN_WINDOW_MS = 72 * 60 * 60 * 1000;

/** Longest timer the product screen sets: Android warns about minute-long ones. */
const MAX_TIMER_MS = 60 * 1000;

export type SaleTiming =
    | {kind: 'countdown'; days: number; hours: number; minutes: number}
    | {kind: 'date'; endsAt: string}
    | {kind: 'ended'};

/** How a sale's end reads at `now`; null when it has no end. */
export function saleTiming(
    endsAt: string | null | undefined,
    now: number,
    windowMs = COUNTDOWN_WINDOW_MS,
): SaleTiming | null {
    if (!endsAt) return null;
    const end = Date.parse(endsAt);
    if (!Number.isFinite(end)) return null;

    const msLeft = end - now;
    if (msLeft <= 0) return {kind: 'ended'};
    if (msLeft > windowMs) return {kind: 'date', endsAt};

    // Rounded up: with 40 seconds left the sale is still on, and "0m" would
    // say it had ended.
    const totalMinutes = Math.ceil(msLeft / 60_000);
    return {
        kind: 'countdown',
        days: Math.floor(totalMinutes / 1440),
        hours: Math.floor((totalMinutes % 1440) / 60),
        minutes: totalMinutes % 60,
    };
}

/**
 * Milliseconds until `saleTiming` would read differently: the countdown's
 * minute ticks over, the window opens, or the sale ends. Null when nothing
 * will change.
 */
export function nextSaleTimingChange(
    endsAt: string | null | undefined,
    now: number,
    windowMs = COUNTDOWN_WINDOW_MS,
): number | null {
    if (!endsAt) return null;
    const end = Date.parse(endsAt);
    if (!Number.isFinite(end)) return null;

    const msLeft = end - now;
    if (msLeft <= 0) return null;
    if (msLeft > windowMs) return Math.min(msLeft - windowMs + 1, MAX_TIMER_MS);
    const intoMinute = msLeft % 60_000;
    return Math.min((intoMinute === 0 ? 60_000 : intoMinute) + 1, MAX_TIMER_MS);
}
