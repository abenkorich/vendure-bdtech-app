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
 * So every token transition removes the whole `customer` subtree. `remove`,
 * not `invalidate`: invalidation keeps the stale data visible while the
 * refetch runs, which is the exact frame we cannot afford.
 *
 * Catalogue queries are left alone. They are identical for every user, and
 * dropping them would make sign-out look like a cold start.
 */

let started = false;

export function startAuthCacheSync(): () => void {
    if (started) return () => {};
    started = true;

    const unsubscribe = onAuthTokenChange(() => {
        queryClient.removeQueries({queryKey: [CUSTOMER_ROOT]});
    });

    return () => {
        started = false;
        unsubscribe();
    };
}
