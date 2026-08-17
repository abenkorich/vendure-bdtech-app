import {useCallback, useSyncExternalStore} from 'react';
import {prefsStorage} from '@/lib/storage/mmkv';
import {
    addSaved,
    isSaved,
    parseSaved,
    removeSaved,
    toggleSaved,
    COMPARE_LIMIT,
    WISHLIST_LIMIT,
    type SavedProduct,
    type ToggleResult,
} from './saved-core';

export type {SavedProduct, ToggleResult} from './saved-core';
export {WISHLIST_LIMIT, COMPARE_LIMIT} from './saved-core';

/**
 * MMKV-backed wishlist / compare store.
 *
 * **There is no backend for either.** The Shop API on this channel was
 * introspected while building this: there is no wishlist query, no wishlist
 * mutation, and nothing resembling a compare list (`myStockAlerts` and
 * `productReviews` are the only customer-scoped extras). So both lists are
 * device-local, per the brief.
 *
 * They live in `prefsStorage`, not `cacheStorage`: a cache wipe must not delete
 * a list the user curated by hand, and these are preferences, not catalogue
 * data. They are also not customer data in the privacy sense — a slug the user
 * tapped a heart on, on their own device — which is what makes unencrypted MMKV
 * acceptable here where order history would not be.
 *
 * Exposed through `useSyncExternalStore` so the heart on a product card, the
 * wishlist screen and the tab badge all re-render on a write without a context
 * provider anywhere. Same shape as `search/recent-searches.ts`.
 */

type ListKey = 'wishlist' | 'compare';

const STORAGE_KEYS: Record<ListKey, string> = {
    wishlist: 'saved.wishlist',
    compare: 'saved.compare',
};

const caches: Partial<Record<ListKey, SavedProduct[]>> = {};
const listeners: Record<ListKey, Set<() => void>> = {
    wishlist: new Set(),
    compare: new Set(),
};

function read(key: ListKey): SavedProduct[] {
    const cached = caches[key];
    if (cached) return cached;
    let parsed: SavedProduct[];
    try {
        parsed = parseSaved(prefsStorage().getString(STORAGE_KEYS[key]));
    } catch {
        // Storage unavailable: an empty list beats a crash on first render.
        parsed = [];
    }
    caches[key] = parsed;
    return parsed;
}

function write(key: ListKey, next: SavedProduct[]): void {
    caches[key] = next;
    try {
        prefsStorage().set(STORAGE_KEYS[key], JSON.stringify(next));
    } catch {
        // Keep the in-memory list and lose only the persistence.
    }
    listeners[key].forEach(listener => listener());
}

function subscribe(key: ListKey): (listener: () => void) => () => void {
    return listener => {
        listeners[key].add(listener);
        return () => {
            listeners[key].delete(listener);
        };
    };
}

export interface SavedList {
    items: SavedProduct[];
    count: number;
    has: (slug: string) => boolean;
    add: (item: Omit<SavedProduct, 'savedAt'>) => void;
    remove: (slug: string) => void;
    /** Returns whether the item ended up saved, and whether the list was full. */
    toggle: (item: Omit<SavedProduct, 'savedAt'>) => ToggleResult;
    clear: () => void;
    limit: number;
}

function useSavedList(key: ListKey, limit: number): SavedList {
    const items = useSyncExternalStore(
        subscribe(key),
        () => read(key),
        () => read(key),
    );

    const has = useCallback((slug: string) => isSaved(read(key), slug), [key]);

    const add = useCallback(
        (item: Omit<SavedProduct, 'savedAt'>) => {
            write(key, addSaved(read(key), {...item, savedAt: Date.now()}, limit));
        },
        [key, limit],
    );

    const remove = useCallback(
        (slug: string) => {
            write(key, removeSaved(read(key), slug));
        },
        [key],
    );

    const toggle = useCallback(
        (item: Omit<SavedProduct, 'savedAt'>): ToggleResult => {
            const result = toggleSaved(read(key), {...item, savedAt: Date.now()}, limit);
            // A rejected add (list full) must not churn the store and wake
            // every subscriber for nothing.
            if (!result.atLimit) write(key, result.list);
            return result;
        },
        [key, limit],
    );

    const clear = useCallback(() => write(key, []), [key]);

    return {items, count: items.length, has, add, remove, toggle, clear, limit};
}

export function useWishlist(): SavedList {
    return useSavedList('wishlist', WISHLIST_LIMIT);
}

export function useCompare(): SavedList {
    return useSavedList('compare', COMPARE_LIMIT);
}

/** Test seam: drops the memoised lists so a test starts from a clean slate. */
export function resetSavedCaches(): void {
    delete caches.wishlist;
    delete caches.compare;
}
