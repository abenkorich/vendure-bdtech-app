import {
    useMutation,
    useQuery,
    useQueryClient,
    type QueryClient,
    type UseQueryResult,
} from '@tanstack/react-query';
import {query, mutate} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import {
    GetEligibleShippingMethodsQuery,
    GetEligiblePaymentMethodsQuery,
} from '@/lib/vendure/queries';
import {
    SetCustomerForOrderMutation,
    SetOrderShippingAddressMutation,
    SetOrderBillingAddressMutation,
    SetOrderShippingMethodMutation,
} from '@/lib/vendure/mutations';
import {
    GetYalidinePickupCentersQuery,
    SetYalidinePickupCenterMutation,
    type YalidinePickupCentersResult,
} from '@/lib/vendure/yalidine';
import {
    GetDhdPickupDesksQuery,
    SetDhdPickupDeskMutation,
    type DhdPickupDesksResult,
} from '@/lib/vendure/dhd';
import type {VariablesOf} from '@/graphql';
import {unwrapResult} from '@/lib/types';

/**
 * Checkout hooks.
 *
 * Nothing here is optimistic, and that is the deliberate opposite of the cart.
 * A quantity the server later disagrees with costs a redraw; a shipping method
 * or an address the server did not actually accept costs a parcel sent to the
 * wrong wilaya. Every step therefore waits for the server and re-reads the
 * order, which is also the only way the totals shown on the review step are the
 * totals the customer will be asked for at the door.
 *
 * Eligibility is *derived server-side and re-read after every change*:
 * shipping methods depend on the address (wilaya), and payment methods depend
 * on the shipping method (Yalidine COD is only offered with a Yalidine
 * carrier). Caching either across a change is how a customer ends up paying
 * cash to a courier who does not collect it.
 */

const AUTH = {useAuthToken: true} as const;

/* ------------------------------------------------------------- eligibility */

export interface EligibleShippingMethod {
    id: string;
    name: string;
    code: string;
    description?: string | null;
    priceWithTax: number;
}

export interface EligiblePaymentMethod {
    id: string;
    name: string;
    code: string;
    description?: string | null;
    isEligible: boolean;
    eligibilityMessage?: string | null;
}

/**
 * Shipping methods for the current address.
 *
 * `enabled` is the guard that matters: querying before an address is set
 * returns the address-independent methods only (in-store pickup), and showing
 * that list as "your delivery options" is worse than showing nothing.
 */
export function useEligibleShippingMethods(
    enabled: boolean,
): UseQueryResult<EligibleShippingMethod[], Error> {
    return useQuery({
        queryKey: queryKeys.eligibleShippingMethods(),
        enabled,
        // Recomputed by the backend from the order; never serve a cached list.
        staleTime: 0,
        gcTime: 0,
        queryFn: async ({signal}) => {
            const {data} = await query(GetEligibleShippingMethodsQuery, {}, {...AUTH, signal});
            return data.eligibleShippingMethods ?? [];
        },
    });
}

/** Payment methods, filtered to the eligible ones — see the note above. */
export function useEligiblePaymentMethods(
    enabled: boolean,
): UseQueryResult<EligiblePaymentMethod[], Error> {
    return useQuery({
        queryKey: queryKeys.eligiblePaymentMethods(),
        enabled,
        staleTime: 0,
        gcTime: 0,
        queryFn: async ({signal}) => {
            const {data} = await query(GetEligiblePaymentMethodsQuery, {}, {...AUTH, signal});
            return (data.eligiblePaymentMethods ?? []).filter(method => method.isEligible);
        },
    });
}

/* ------------------------------------------------------------------ mutate */

function invalidateOrder(client: QueryClient): void {
    void client.invalidateQueries({queryKey: queryKeys.activeOrder()});
    void client.invalidateQueries({queryKey: queryKeys.activeOrderForCheckout()});
}

/** Address changes invalidate every downstream choice, in dependency order. */
function invalidateAfterAddress(client: QueryClient): void {
    invalidateOrder(client);
    void client.invalidateQueries({queryKey: queryKeys.eligibleShippingMethods()});
    void client.invalidateQueries({queryKey: queryKeys.eligiblePaymentMethods()});
}

export type GuestCustomerInput = VariablesOf<typeof SetCustomerForOrderMutation>['input'];

/**
 * Attach contact details to the order (guest checkout).
 *
 * `AlreadyLoggedInError` is treated as success, not as a failure: a customer
 * who signed in between opening checkout and submitting this step already has
 * the details this call would set, and showing them an error for being signed
 * in would be absurd.
 */
export function useSetCustomerForOrder() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: ['checkout', 'set-customer'],
        mutationFn: async (input: GuestCustomerInput) => {
            const {data} = await mutate(SetCustomerForOrderMutation, {input}, AUTH);
            const result = data.setCustomerForOrder;
            if (result.__typename === 'AlreadyLoggedInError') return result;
            return unwrapResult(result);
        },
        onSuccess: () => invalidateOrder(client),
    });
}

export type OrderAddressInput = VariablesOf<typeof SetOrderShippingAddressMutation>['input'];

export interface SetShippingAddressInput {
    address: OrderAddressInput;
    /** Also set as the billing address. Default for a COD order. */
    useSameForBilling?: boolean;
}

export function useSetShippingAddress() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: ['checkout', 'set-shipping-address'],
        mutationFn: async ({address, useSameForBilling = true}: SetShippingAddressInput) => {
            const {data} = await mutate(SetOrderShippingAddressMutation, {input: address}, AUTH);
            const order = unwrapResult(data.setOrderShippingAddress);

            if (useSameForBilling) {
                const billing = await mutate(
                    SetOrderBillingAddressMutation,
                    {input: address},
                    AUTH,
                );
                unwrapResult(billing.data.setOrderBillingAddress);
            }

            return order;
        },
        onSuccess: () => invalidateAfterAddress(client),
    });
}

export function useSetShippingMethod() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: ['checkout', 'set-shipping-method'],
        mutationFn: async (shippingMethodId: string) => {
            const {data} = await mutate(
                SetOrderShippingMethodMutation,
                {shippingMethodId: [shippingMethodId]},
                AUTH,
            );
            return unwrapResult(data.setOrderShippingMethod);
        },
        onSuccess: () => {
            invalidateOrder(client);
            // COD eligibility follows the carrier, so the payment list is stale
            // the moment the method changes.
            void client.invalidateQueries({queryKey: queryKeys.eligiblePaymentMethods()});
        },
    });
}

/* ---------------------------------------------------------------- stopdesk */

/**
 * Yalidine pickup centres for the order's wilaya.
 *
 * Resolved from the order's shipping address on the server, which is why it
 * takes no arguments and why it must not be read before the address step.
 */
export function useYalidinePickupCenters(
    enabled: boolean,
): UseQueryResult<YalidinePickupCentersResult, Error> {
    return useQuery({
        queryKey: [...queryKeys.activeOrderForCheckout(), 'yalidine-centers'] as const,
        enabled,
        staleTime: 0,
        gcTime: 0,
        queryFn: async ({signal}) => {
            const {data} = await query(GetYalidinePickupCentersQuery, {}, {...AUTH, signal});
            const result = (data as {yalidinePickupCenters?: YalidinePickupCentersResult})
                .yalidinePickupCenters;
            return result ?? {centers: [], suggestedCenterId: null, selectedCenterId: null};
        },
    });
}

/** Persist (or clear, with `null`) the chosen stop-desk centre on the order. */
export function useSetYalidinePickupCenter() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: ['checkout', 'set-pickup-center'],
        mutationFn: async (centerId: number | null) => {
            const {data} = await mutate(SetYalidinePickupCenterMutation, {centerId}, AUTH);
            const result = (data as {setYalidinePickupCenter?: {id?: string}})
                .setYalidinePickupCenter;
            if (!result?.id) throw new Error('Failed to set the pickup centre');
            return result;
        },
        onSuccess: () => invalidateOrder(client),
    });
}

/**
 * DHD stop-desk offices for the order's wilaya.
 *
 * Same shape and same server-side address resolution as the Yalidine centres —
 * DHD calls them "bureaux" (`GET api/v1/get/desks`) and gives them no id, so the
 * server hands back a stable one derived from wilaya + name.
 */
export function useDhdPickupDesks(
    enabled: boolean,
): UseQueryResult<DhdPickupDesksResult, Error> {
    return useQuery({
        queryKey: [...queryKeys.activeOrderForCheckout(), 'dhd-desks'] as const,
        enabled,
        staleTime: 0,
        gcTime: 0,
        queryFn: async ({signal}) => {
            const {data} = await query(GetDhdPickupDesksQuery, {}, {...AUTH, signal});
            const result = (data as {dhdPickupDesks?: DhdPickupDesksResult}).dhdPickupDesks;
            return result ?? {desks: [], suggestedDeskId: null, selectedDeskId: null};
        },
    });
}

/** Persist (or clear, with `null`) the chosen DHD stop-desk office on the order. */
export function useSetDhdPickupDesk() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: ['checkout', 'set-pickup-desk'],
        mutationFn: async (deskId: number | null) => {
            const {data} = await mutate(SetDhdPickupDeskMutation, {deskId}, AUTH);
            const result = (data as {setDhdPickupDesk?: {id?: string}}).setDhdPickupDesk;
            if (!result?.id) throw new Error('Failed to set the pickup office');
            return result;
        },
        onSuccess: () => invalidateOrder(client),
    });
}
