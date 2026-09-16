/**
 * Coalesces single-key loads made in the same moment into one request.
 *
 * Written for member prices (`features/product/member-discounts.ts`): every
 * card on a screen asks for its own product, so each product is its own cache
 * entry and a product already answered is never asked for again, yet a grid
 * of 24 cards still costs one round-trip rather than 24. Pure and free of
 * React Native so the batching is testable in Node.
 */

export interface BatchLoader<V> {
    /** Resolves with the value for `key`, or null when the batch had none. */
    load(key: string): Promise<V | null>;
}

export interface BatchLoaderOptions {
    /** Keys per request; a larger batch is split. */
    maxBatchSize: number;
    /**
     * How long to collect keys before sending. A frame is enough: the cards of
     * one screen mount, and ask, within the same render pass.
     */
    delayMs?: number;
}

interface Waiter<V> {
    resolve: (value: V | null) => void;
    reject: (error: unknown) => void;
}

export function createBatchLoader<V>(
    fetchMany: (keys: readonly string[]) => Promise<ReadonlyMap<string, V>>,
    {maxBatchSize, delayMs = 0}: BatchLoaderOptions,
): BatchLoader<V> {
    let queued = new Map<string, Waiter<V>[]>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const settle = (batch: Map<string, Waiter<V>[]>, keys: readonly string[]) => {
        fetchMany(keys).then(
            results => {
                for (const key of keys) {
                    for (const waiter of batch.get(key) ?? []) waiter.resolve(results.get(key) ?? null);
                }
            },
            error => {
                for (const key of keys) {
                    for (const waiter of batch.get(key) ?? []) waiter.reject(error);
                }
            },
        );
    };

    const flush = () => {
        timer = null;
        const batch = queued;
        queued = new Map();
        const keys = [...batch.keys()];
        const size = Math.max(1, maxBatchSize);
        for (let start = 0; start < keys.length; start += size) {
            settle(batch, keys.slice(start, start + size));
        }
    };

    return {
        load(key) {
            return new Promise<V | null>((resolve, reject) => {
                const waiters = queued.get(key);
                if (waiters) waiters.push({resolve, reject});
                else queued.set(key, [{resolve, reject}]);
                if (!timer) timer = setTimeout(flush, delayMs);
            });
        },
    };
}
