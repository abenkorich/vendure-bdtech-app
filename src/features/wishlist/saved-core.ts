/**
 * The pure half of the saved-product lists (wishlist and compare).
 *
 * Split from the MMKV-backed store for the same reason `search/recent-core.ts`
 * is: `tests/run.mjs` bundles for Node, and anything reaching React Native (or
 * MMKV) fails to build with an error that does not name the real cause. The
 * rules worth testing are here.
 *
 * A saved entry is a **slug plus a display snapshot**, not just an id. Storing
 * only the slug would mean an empty wishlist screen until a network round-trip
 * per item resolves, which on Algerian mobile data is several seconds of
 * skeletons for a list the user has already curated. The snapshot renders
 * instantly and is re-validated against the catalogue in the background, so a
 * price change corrects itself without ever showing nothing.
 */

export interface SavedProduct {
    /** Route key and cache key. The identity of the entry. */
    slug: string;
    name: string;
    /** Integer minor units, as everywhere else. Never render raw. */
    priceWithTax: number;
    currencyCode: string;
    imageUrl?: string | null;
    /** Epoch ms, so the list can be shown most-recently-saved first. */
    savedAt: number;
}

/** Wishlists get long; compare tables do not (see COMPARE_LIMIT). */
export const WISHLIST_LIMIT = 100;

/**
 * Four products is what fits on a phone-width spec table while each column is
 * still readable. A fifth column would make every value ellipsise, which
 * defeats the entire purpose of comparing specs.
 */
export const COMPARE_LIMIT = 4;

export function isSaved(list: readonly SavedProduct[], slug: string): boolean {
    return list.some(item => item.slug === slug);
}

/**
 * Add an entry, most recent first, de-duplicated by slug.
 *
 * Re-saving an existing product *refreshes* it rather than duplicating it: the
 * snapshot may carry a newer price, and two rows for one product in a compare
 * table is a bug the user cannot fix.
 */
export function addSaved(
    list: readonly SavedProduct[],
    item: SavedProduct,
    limit: number,
): SavedProduct[] {
    const without = list.filter(existing => existing.slug !== item.slug);
    return [item, ...without].slice(0, limit);
}

export function removeSaved(list: readonly SavedProduct[], slug: string): SavedProduct[] {
    return list.filter(item => item.slug !== slug);
}

/**
 * Toggle, reporting what happened.
 *
 * `atLimit` is the case that must not be silent: a compare list already holding
 * four products cannot take a fifth, and a heart button that does nothing on
 * tap is indistinguishable from a broken one.
 */
export interface ToggleResult {
    list: SavedProduct[];
    added: boolean;
    atLimit: boolean;
}

export function toggleSaved(
    list: readonly SavedProduct[],
    item: SavedProduct,
    limit: number,
): ToggleResult {
    if (isSaved(list, item.slug)) {
        return {list: removeSaved(list, item.slug), added: false, atLimit: false};
    }
    if (list.length >= limit) {
        return {list: [...list], added: false, atLimit: true};
    }
    return {list: addSaved(list, item, limit), added: true, atLimit: false};
}

/**
 * Parse a persisted blob defensively.
 *
 * Anything unreadable yields an empty list rather than throwing. A corrupt
 * preference blob must cost the user their wishlist, never the screen that
 * renders it.
 */
export function parseSaved(raw: string | undefined): SavedProduct[] {
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isSavedProduct);
    } catch {
        return [];
    }
}

function isSavedProduct(value: unknown): value is SavedProduct {
    if (value === null || typeof value !== 'object') return false;
    const item = value as Partial<SavedProduct>;
    return (
        typeof item.slug === 'string' &&
        item.slug.length > 0 &&
        typeof item.name === 'string' &&
        // A price that is not a number would render as NaN DZD, so an entry
        // missing one is dropped rather than shown.
        typeof item.priceWithTax === 'number' &&
        Number.isFinite(item.priceWithTax) &&
        typeof item.currencyCode === 'string'
    );
}
