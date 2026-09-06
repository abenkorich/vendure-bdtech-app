import {useSyncExternalStore} from 'react';
import {prefsStorage} from '@/lib/storage/mmkv';
import {parseHistory, rankVisited, recordVisit, type CollectionVisit} from './history-core';

/**
 * Collections this device has browsed, persisted to the prefs MMKV instance.
 *
 * Device-local on purpose: it is a signal about *this phone*, not customer
 * data, so it needs no account, survives sign-out, and never leaves the
 * device. The "Explore more" feed reads it; the collection and product
 * screens write it.
 */

const KEY = 'explore.visited';

let cache: CollectionVisit[] | undefined;
const listeners = new Set<() => void>();

function read(): CollectionVisit[] {
    if (cache) return cache;
    try {
        const raw = prefsStorage().getString(KEY);
        cache = parseHistory(raw ? JSON.parse(raw) : []);
    } catch {
        cache = [];
    }
    return cache;
}

function write(next: CollectionVisit[]): void {
    cache = next;
    try {
        prefsStorage().set(KEY, JSON.stringify(next));
    } catch {
        // Storage unavailable: keep the in-memory list for this session.
    }
    listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Record that the user opened a collection (directly, or through a product). */
export function recordCollectionVisit(slug: string | undefined | null): void {
    if (!slug) return;
    write(recordVisit(read(), slug));
}

/** Visited collections, best first, for the feed. Re-renders on every write. */
export function useVisitedCollections(limit = 4): string[] {
    const history = useSyncExternalStore(subscribe, read, read);
    return rankVisited(history, limit);
}
