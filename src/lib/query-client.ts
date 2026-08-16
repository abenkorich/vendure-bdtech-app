import {QueryClient} from '@tanstack/react-query';
import {ServerUnreachableError} from '@/lib/vendure/api';

/**
 * Shared query client.
 *
 * Defaults are tuned for a mobile shopping app on a network that is often
 * slow or intermittent (this store's customers are in Algeria, largely on
 * mobile data):
 *
 * - Catalogue data is stale-tolerant, so a warm screen renders instantly from
 *   cache and refreshes behind the scenes.
 * - Retries apply only to reachability failures. Retrying a GraphQL error
 *   (out of stock, invalid coupon) just delays the message the user needs.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 24 * 60 * 60 * 1000,
            retry: (failureCount, error) =>
                error instanceof ServerUnreachableError && failureCount < 2,
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: false,
        },
    },
});
