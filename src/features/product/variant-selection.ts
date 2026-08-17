/**
 * Variant selection.
 *
 * Pure and free of React and React Native imports on purpose: this is the
 * logic that decides what the customer is about to buy, and it is the only part
 * of the product screen a Node test can exercise (see AGENTS.md — a test that
 * reaches React Native cannot be bundled).
 *
 * The rules it encodes:
 *
 * - A product with one variant has no selection to make; the variant is simply
 *   the product.
 * - An option combination that no variant satisfies must be *unselectable*,
 *   not merely fruitless. Vendure 3.6 shares option groups across products, so
 *   an unfiltered UI offers combinations that cannot exist and ends with a
 *   permanently disabled add-to-cart and no explanation.
 * - Changing one group keeps the other choices where they are still possible,
 *   and otherwise falls back to the first variant that matches the new choice.
 *   Silently clearing the rest is what makes a variant picker feel broken.
 */

export interface VariantOptionLike {
    id: string;
    name: string;
    groupId: string;
}

export interface VariantLike {
    id: string;
    name: string;
    sku: string;
    priceWithTax: number;
    stockLevel: string;
    options: readonly VariantOptionLike[];
}

export interface OptionGroupLike {
    id: string;
    name: string;
    options: readonly {id: string; name: string}[];
}

/** Map of groupId -> selected optionId. */
export type Selection = Record<string, string>;

/** The selection matching a variant, i.e. the state that renders it as chosen. */
export function selectionForVariant(variant: VariantLike): Selection {
    const selection: Selection = {};
    for (const option of variant.options) selection[option.groupId] = option.id;
    return selection;
}

function matches(variant: VariantLike, selection: Selection): boolean {
    return Object.entries(selection).every(([groupId, optionId]) =>
        variant.options.some(option => option.groupId === groupId && option.id === optionId),
    );
}

/** The variant satisfying every selected option, or null while incomplete. */
export function findVariant(
    variants: readonly VariantLike[],
    selection: Selection,
    groupCount: number,
): VariantLike | null {
    if (Object.keys(selection).length < groupCount) return null;
    return variants.find(variant => matches(variant, selection)) ?? null;
}

/**
 * Option ids that some variant can still deliver, given every *other* group's
 * current choice. Anything outside this set is rendered disabled.
 */
export function availableOptionIds(
    variants: readonly VariantLike[],
    selection: Selection,
    groupId: string,
): Set<string> {
    const others: Selection = {};
    for (const [key, value] of Object.entries(selection)) {
        if (key !== groupId) others[key] = value;
    }

    const ids = new Set<string>();
    for (const variant of variants) {
        if (!matches(variant, others)) continue;
        for (const option of variant.options) {
            if (option.groupId === groupId) ids.add(option.id);
        }
    }
    return ids;
}

/**
 * Apply a tap on one option, repairing any now-impossible sibling choices by
 * snapping to the first variant that carries the new option.
 */
export function selectOption(
    variants: readonly VariantLike[],
    selection: Selection,
    groupId: string,
    optionId: string,
    groupCount: number,
): Selection {
    const next: Selection = {...selection, [groupId]: optionId};
    if (findVariant(variants, next, groupCount)) return next;

    const fallback = variants.find(variant =>
        variant.options.some(option => option.groupId === groupId && option.id === optionId),
    );
    return fallback ? selectionForVariant(fallback) : next;
}

/** The selection a product opens on: the first in-stock variant, else the first. */
export function initialSelection(variants: readonly VariantLike[]): Selection {
    if (variants.length === 0) return {};
    const preferred = variants.find(variant => variant.stockLevel !== 'OUT_OF_STOCK');
    return selectionForVariant(preferred ?? variants[0]);
}

export type StockState = 'in-stock' | 'low-stock' | 'out-of-stock';

/**
 * Vendure's `stockLevel` is a *string*, and what it contains depends on the
 * channel's stock-display strategy: it can be one of the named levels, or a
 * plain number when the channel exposes exact counts. Both are handled here so
 * a numeric channel does not render every product as out of stock.
 */
export function stockState(stockLevel: string | null | undefined): StockState {
    if (!stockLevel) return 'out-of-stock';
    const normalized = stockLevel.toUpperCase();
    if (normalized === 'OUT_OF_STOCK') return 'out-of-stock';
    if (normalized === 'LOW_STOCK') return 'low-stock';
    if (normalized === 'IN_STOCK') return 'in-stock';

    const count = Number(stockLevel);
    if (Number.isFinite(count)) {
        if (count <= 0) return 'out-of-stock';
        return count <= 5 ? 'low-stock' : 'in-stock';
    }
    // An unrecognised value is treated as available: refusing to sell a product
    // because of an unknown label is the more expensive mistake.
    return 'in-stock';
}
