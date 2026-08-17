import {dehydrate, hydrate, type QueryClient, type DehydratedState} from '@tanstack/react-query';
import {CATALOGUE_ROOT} from '@/lib/query-keys';

/**
 * Cache persistence, storage-agnostic half.
 *
 * Kept free of `react-native-mmkv` (and therefore of React Native) so the
 * decisions that actually carry risk — *what* is written to an unencrypted
 * store, and when a persisted blob must be thrown away — are unit-testable in
 * Node. The MMKV wiring lives in `persist-query-cache.ts`.
 */

/** Minimal storage surface. MMKV satisfies this; so does a Map in a test. */
export interface SyncStorage {
    getString(key: string): string | undefined;
    set(key: string, value: string): void;
    /** MMKV names this `remove`; the boolean return is ignored. */
    remove(key: string): unknown;
}

export interface PersistedCache {
    version: number;
    /** Channel token hash-free marker; a different buster drops the blob. */
    buster: string;
    timestamp: number;
    state: DehydratedState;
}

export const PERSIST_KEY = 'tanstack-query-cache';

/**
 * Bump when the persisted shape or the catalogue documents change in a way
 * that makes an old blob wrong rather than merely stale.
 *
 * v2: `useStockedCollections` changed its cached value from an array to
 * `{rails, totals}`. An old blob crashed the shop screen on `data.rails.map`,
 * which is the failure this version marker exists to prevent — the cache
 * outlives a code change, so a shape change must invalidate it.
 */
export const PERSIST_VERSION = 2;

/** Older than this and a cold start refetches instead of showing stale prices. */
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Only catalogue queries are persisted.
 *
 * MMKV is unencrypted, so anything customer-scoped (the active order, the
 * customer record, addresses, past orders) must never be written to it. The
 * key factory makes that a prefix check rather than a per-query judgement,
 * which is the point: a new customer-scoped hook is excluded by default
 * because it does not start with `catalogue`.
 */
export function isPersistable(queryKey: readonly unknown[]): boolean {
    return queryKey[0] === CATALOGUE_ROOT;
}

/** Serialise the persistable slice of the cache. Returns null if nothing to save. */
export function serializeCache(client: QueryClient, buster: string, now = Date.now()): string | null {
    const state = dehydrate(client, {
        shouldDehydrateQuery: query =>
            query.state.status === 'success' && isPersistable(query.queryKey),
        // Mutations are either in flight (meaningless after a restart) or done.
        shouldDehydrateMutation: () => false,
    });

    if (state.queries.length === 0) return null;

    const payload: PersistedCache = {version: PERSIST_VERSION, buster, timestamp: now, state};
    try {
        return JSON.stringify(payload);
    } catch {
        // A non-serialisable value in the cache should cost a refetch, not a crash.
        return null;
    }
}

export type RestoreOutcome =
    | {status: 'restored'; queries: number}
    | {status: 'empty'}
    | {status: 'discarded'; reason: 'malformed' | 'version' | 'buster' | 'expired' | 'not-persistable'};

/**
 * Restore a persisted blob into a client, rejecting anything suspect.
 *
 * The `not-persistable` guard is deliberate paranoia: if a customer-scoped
 * query ever reached the blob through an older build, it must not be hydrated
 * back into a fresh session where it could be shown to a different user.
 */
export function restoreCache(
    client: QueryClient,
    raw: string | undefined,
    buster: string,
    now = Date.now(),
): RestoreOutcome {
    if (!raw) return {status: 'empty'};

    let parsed: PersistedCache;
    try {
        parsed = JSON.parse(raw) as PersistedCache;
    } catch {
        return {status: 'discarded', reason: 'malformed'};
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.state) {
        return {status: 'discarded', reason: 'malformed'};
    }
    if (parsed.version !== PERSIST_VERSION) return {status: 'discarded', reason: 'version'};
    if (parsed.buster !== buster) return {status: 'discarded', reason: 'buster'};
    if (!Number.isFinite(parsed.timestamp) || now - parsed.timestamp > MAX_AGE_MS) {
        return {status: 'discarded', reason: 'expired'};
    }

    const queries = parsed.state.queries ?? [];
    if (queries.some(q => !isPersistable(q.queryKey as readonly unknown[]))) {
        return {status: 'discarded', reason: 'not-persistable'};
    }

    hydrate(client, parsed.state);
    return {status: 'restored', queries: queries.length};
}
