import {useCallback, useSyncExternalStore} from 'react';
import {prefsStorage} from '@/lib/storage/mmkv';
import {mergeRecent} from './recent-core';
export {mergeRecent} from './recent-core';

/**
 * Recent searches, persisted to the *prefs* MMKV instance.
 *
 * Prefs rather than the query cache: a cache wipe must not erase what the user
 * typed, and this is a preference, not catalogue data. It is also never
 * customer data — a term the user typed on this device, nothing more.
 *
 * Exposed through `useSyncExternalStore` so every mounted consumer (the screen
 * and any future overlay) re-renders on a write without a context provider.
 */

const KEY = 'search.recent';

let cache: string[] | undefined;
const listeners = new Set<() => void>();

function read(): string[] {
    if (cache) return cache;
    try {
        const raw = prefsStorage().getString(KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        cache = Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
    } catch {
        // A corrupt or unreadable blob costs the user their history, not the
        // screen: recents are the one thing here that must never throw.
        cache = [];
    }
    return cache;
}

function write(next: string[]): void {
    cache = next;
    try {
        prefsStorage().set(KEY, JSON.stringify(next));
    } catch {
        // Storage full or unavailable: keep the in-memory list, lose the
        // persistence. Still better than a crash on a keystroke.
    }
    listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export interface RecentSearches {
    recent: string[];
    /** Records a term. No-op for an empty or whitespace-only string. */
    push: (term: string) => void;
    remove: (term: string) => void;
    clear: () => void;
}

export function useRecentSearches(): RecentSearches {
    const recent = useSyncExternalStore(subscribe, read, read);

    const push = useCallback((term: string) => {
        const current = read();
        const next = mergeRecent(current, term);
        // Identical list: skip the write and the re-render it would push
        // through every consumer. Searching the same term twice is common.
        const unchanged =
            next.length === current.length && next.every((item, i) => item === current[i]);
        if (unchanged) return;
        write(next);
    }, []);

    const remove = useCallback((term: string) => {
        const folded = term.trim().toLocaleLowerCase();
        write(read().filter(item => item.trim().toLocaleLowerCase() !== folded));
    }, []);

    const clear = useCallback(() => write([]), []);

    return {recent, push, remove, clear};
}

/** Test seam: drops the memoised list so a test can start from a clean slate. */
export function resetRecentSearchesCache(): void {
    cache = undefined;
}
