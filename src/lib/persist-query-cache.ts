import type {QueryClient} from '@tanstack/react-query';
import {cacheStorage} from '@/lib/storage/mmkv';
import {env} from '@/lib/env';
import {
    PERSIST_KEY,
    restoreCache,
    serializeCache,
    isPersistable,
    type RestoreOutcome,
    type SyncStorage,
} from '@/lib/persist-core';

/**
 * MMKV-backed persistence for the query cache.
 *
 * Why this exists: a returning customer on Algerian mobile data should see the
 * catalogue immediately rather than a skeleton while the first request flies.
 * Restore is synchronous — MMKV reads are — so it can run before the first
 * render without an await, which is the whole reason MMKV was chosen over
 * AsyncStorage here.
 *
 * What is *not* persisted: anything customer-scoped. See `persist-core.ts`;
 * MMKV is not encrypted.
 */

/**
 * Changing channel means a different catalogue and currency, so a blob written
 * under another token must not be shown. The token is not a secret (it is an
 * `EXPO_PUBLIC_*` value inlined into the bundle), but it is still not written
 * to disk: only its length and last 4 characters, which is enough to detect a
 * change and useless to an attacker who already has the bundle.
 */
function cacheBuster(): string {
    const token = env.vendureChannelToken;
    return `v1:${token.length}:${token.slice(-4)}`;
}

/** Debounce so a burst of resolving queries writes once, not once each. */
const WRITE_DEBOUNCE_MS = 1500;

function mmkv(): SyncStorage {
    return cacheStorage();
}

/**
 * Hydrate the cache from disk. Call once, before the first render.
 * Never throws: a bad cache costs a refetch, it does not break the launch.
 */
export function restorePersistedCache(client: QueryClient): RestoreOutcome {
    try {
        const raw = mmkv().getString(PERSIST_KEY);
        const outcome = restoreCache(client, raw, cacheBuster());
        if (outcome.status === 'discarded') mmkv().remove(PERSIST_KEY);
        return outcome;
    } catch {
        return {status: 'discarded', reason: 'malformed'};
    }
}

/**
 * Subscribe to the cache and mirror the catalogue slice to MMKV.
 * Returns an unsubscribe function.
 */
export function startPersistingCache(client: QueryClient): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const write = () => {
        timer = undefined;
        try {
            const serialized = serializeCache(client, cacheBuster());
            if (serialized === null) mmkv().remove(PERSIST_KEY);
            else mmkv().set(PERSIST_KEY, serialized);
        } catch {
            // Storage full or unavailable. The app works uncached; nothing to do.
        }
    };

    const unsubscribe = client.getQueryCache().subscribe(event => {
        // Only a settled catalogue query changes what would be written.
        if (!isPersistable(event.query.queryKey)) return;
        if (event.type !== 'updated' && event.type !== 'removed') return;
        if (timer) return;
        timer = setTimeout(write, WRITE_DEBOUNCE_MS);
    });

    return () => {
        if (timer) clearTimeout(timer);
        unsubscribe();
    };
}

/** Drop the persisted catalogue blob (settings screen, or a corrupt state). */
export function clearPersistedCache(): void {
    try {
        mmkv().remove(PERSIST_KEY);
    } catch {
        // Nothing meaningful to do; the in-memory cache is unaffected.
    }
}
