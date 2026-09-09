/**
 * Merchandising fields the search index does not carry.
 *
 * A subset of the web storefront's `src/lib/product-card-extras.ts`, kept
 * diffable against it: only the quantity rule is ported, because the app's
 * cards show a SKU and a count and nothing else. The sale and new-arrival
 * flags there need `compareAtPrice` and `createdAt`, which the app's card
 * sources do not fetch.
 *
 * The rule worth copying exactly is the refusal to invent a number. Vendure
 * returns `stockLevel` either as a count ("42") or as one of the masking
 * enums, depending on how the channel is configured; turning `IN_STOCK` into
 * a quantity would put a made-up figure on a product page.
 */

const STOCK_ENUMS = new Set(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']);

function numberFromUnknown(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed || STOCK_ENUMS.has(trimmed.toUpperCase())) return null;
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    return null;
}

/** Exact quantity for display — never invents one from IN_STOCK / LOW_STOCK. */
export function stockLevelToDisplayQuantity(stockLevel: string | null | undefined): number | null {
    if (stockLevel == null) return null;
    const trimmed = stockLevel.trim();
    if (!trimmed) return null;
    if (trimmed.toUpperCase() === 'OUT_OF_STOCK') return 0;
    if (STOCK_ENUMS.has(trimmed.toUpperCase())) return null;
    return numberFromUnknown(trimmed);
}
