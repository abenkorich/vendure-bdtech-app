import assert from 'node:assert/strict';
import {QueryClient} from '@tanstack/react-query';
import {
    serializeCache,
    restoreCache,
    isPersistable,
    PERSIST_VERSION,
    MAX_AGE_MS,
    type SyncStorage,
} from '@/lib/persist-core';
import {queryKeys, stableParams} from '@/lib/query-keys';

/**
 * Cache-persistence rules.
 *
 * The one that matters most is the privacy rule: MMKV is not encrypted, so a
 * customer's cart, addresses and order history must never reach it. That is
 * enforced by a key prefix, which makes it exactly the kind of invariant a
 * later refactor breaks silently — hence a test that asserts it directly
 * against the real key factory rather than against string literals.
 */

const BUSTER = 'test-buster';

function memoryStorage(): SyncStorage & {dump(): Map<string, string>} {
    const map = new Map<string, string>();
    return {
        getString: key => map.get(key),
        set: (key, value) => void map.set(key, value),
        remove: key => map.delete(key),
        dump: () => map,
    };
}

function clientWith(entries: Array<[readonly unknown[], unknown]>): QueryClient {
    const client = new QueryClient();
    for (const [key, data] of entries) client.setQueryData(key, data);
    return client;
}

export async function run(): Promise<void> {
    // --- the privacy invariant -----------------------------------------
    const customerKeys = [
        queryKeys.activeOrder(),
        queryKeys.activeCustomer(),
        queryKeys.addresses(),
        queryKeys.orders({take: 10}),
        queryKeys.order('ABC123'),
        queryKeys.activeOrderForCheckout(),
        queryKeys.eligibleShippingMethods(),
        queryKeys.eligiblePaymentMethods(),
    ];
    for (const key of customerKeys) {
        assert.equal(isPersistable(key), false, `${JSON.stringify(key)} must not be persisted`);
    }

    const catalogueKeys = [
        queryKeys.product('esp32'),
        queryKeys.collections(),
        queryKeys.collection('arduino', {take: 24}),
        queryKeys.search({term: 'esp'}),
        queryKeys.deals({take: 12}),
        queryKeys.newArrivals({take: 12}),
        queryKeys.blogPosts({take: 6}),
    ];
    for (const key of catalogueKeys) {
        assert.equal(isPersistable(key), true, `${JSON.stringify(key)} should be persisted`);
    }

    // --- serialise: catalogue in, customer data out ---------------------
    const client = clientWith([
        [queryKeys.product('esp32'), {id: '1', name: 'ESP32'}],
        [queryKeys.activeOrder(), {id: '99', code: 'SECRET', totalQuantity: 3}],
        [queryKeys.addresses(), [{id: '1', streetLine1: '12 Rue Didouche Mourad'}]],
    ]);

    const serialized = serializeCache(client, BUSTER);
    assert.ok(serialized, 'a catalogue query produces a blob');
    assert.ok(serialized.includes('ESP32'), 'catalogue data is persisted');
    assert.ok(!serialized.includes('SECRET'), 'the active order never reaches disk');
    assert.ok(
        !serialized.includes('Didouche'),
        'the address book never reaches disk',
    );

    // A cache holding nothing persistable writes nothing at all, rather than
    // an empty envelope that would later look like a valid restore.
    const customerOnly = clientWith([[queryKeys.activeOrder(), {id: '1'}]]);
    assert.equal(serializeCache(customerOnly, BUSTER), null, 'nothing to persist -> null');

    // --- restore round-trip --------------------------------------------
    const storage = memoryStorage();
    storage.set('cache', serialized);

    const restored = new QueryClient();
    const outcome = restoreCache(restored, storage.getString('cache'), BUSTER);
    assert.equal(outcome.status, 'restored', 'a fresh blob restores');
    assert.deepEqual(
        restored.getQueryData(queryKeys.product('esp32')),
        {id: '1', name: 'ESP32'},
        'restored data lands under the same key the hook will read',
    );

    // --- every rejection path -------------------------------------------
    assert.equal(restoreCache(new QueryClient(), undefined, BUSTER).status, 'empty');

    assert.deepEqual(restoreCache(new QueryClient(), 'not json', BUSTER), {
        status: 'discarded',
        reason: 'malformed',
    });

    // A different channel token means a different catalogue and currency.
    assert.deepEqual(restoreCache(new QueryClient(), serialized, 'other-buster'), {
        status: 'discarded',
        reason: 'buster',
    });

    const oldVersion = JSON.stringify({
        ...(JSON.parse(serialized) as Record<string, unknown>),
        version: PERSIST_VERSION - 1,
    });
    assert.deepEqual(restoreCache(new QueryClient(), oldVersion, BUSTER), {
        status: 'discarded',
        reason: 'version',
    });

    // Stale prices are worse than a skeleton.
    const expired = JSON.stringify({
        ...(JSON.parse(serialized) as Record<string, unknown>),
        timestamp: Date.now() - MAX_AGE_MS - 1,
    });
    assert.deepEqual(restoreCache(new QueryClient(), expired, BUSTER), {
        status: 'discarded',
        reason: 'expired',
    });

    // A blob written by an older build that leaked customer data must not be
    // hydrated back into a fresh session.
    const tainted = JSON.parse(serialized) as {
        state: {queries: Array<{queryKey: unknown[]}>};
    };
    tainted.state.queries.push({queryKey: [...queryKeys.activeOrder()]} as never);
    const taintedOutcome = restoreCache(new QueryClient(), JSON.stringify(tainted), BUSTER);
    assert.deepEqual(taintedOutcome, {status: 'discarded', reason: 'not-persistable'});

    // --- key factory ------------------------------------------------------
    assert.deepEqual(
        stableParams({take: 12, term: 'x', skip: undefined}),
        stableParams({term: 'x', take: 12}),
        'params order and undefined values do not change the key',
    );
    assert.deepEqual(
        queryKeys.collection('a', {take: 2, skip: 0}),
        queryKeys.collection('a', {skip: 0, take: 2}),
        'collection keys are stable across param order',
    );
    assert.notDeepEqual(
        queryKeys.search({term: 'a'}),
        queryKeys.search({term: 'b'}),
        'different params are different keys',
    );
}
