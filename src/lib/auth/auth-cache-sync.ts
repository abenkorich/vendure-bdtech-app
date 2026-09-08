import {queryClient} from '@/lib/query-client';
import {CUSTOMER_ROOT} from '@/lib/query-keys';
import {onAuthTokenChange} from '@/lib/auth/token-store';

/**
 * Keep the query cache honest across sign-in and sign-out.
 *
 * The failure this prevents is concrete: the customer subtree (`activeOrder`,
 * `activeCustomer`, addresses, past orders) is fetched with a bearer token. If
 * the token changes and those entries stay, the next screen renders the
 * *previous* session's data — someone else's cart or, worse, their address
 * book — until a refetch happens to land.
 *
 * So every token transition resets the whole `customer` subtree. `reset`,
 * not `invalidate`: invalidation keeps the stale data visible while the
 * refetch runs, which is the exact frame we cannot afford. And `reset`, not
 * `remove`: removing a query that a mounted screen is observing detaches
 * that observer from the cache, so it never hears the refetch and the
 * screen sits on its loading state until it remounts. A reset drops the
 * data the same way and refetches for anyone still watching.
 *
 * Catalogue queries are left alone. They are identical for every user, and
 * dropping them would make sign-out look like a cold start.
 */

let started = false;

export function startAuthCacheSync(): () => void {
    if (started) return () => {};
    started = true;

    const unsubscribe = onAuthTokenChange(() => {
        void queryClient.resetQueries({queryKey: [CUSTOMER_ROOT]});
    });

    return () => {
        started = false;
        unsubscribe();
    };
}
