import {useMutation, useQuery, useQueryClient, type UseQueryResult} from '@tanstack/react-query';
import {query, mutate} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import {
    GetCustomerAddressesQuery,
    GetCustomerOrdersQuery,
    GetOrderDetailQuery,
    GetAvailableCountriesQuery,
} from '@/lib/vendure/queries';
import {
    CreateCustomerAddressMutation,
    UpdateCustomerAddressMutation,
    DeleteCustomerAddressMutation,
    UpdateCustomerMutation,
    UpdateCustomerPasswordMutation,
} from '@/lib/vendure/mutations';
import type {VariablesOf} from '@/graphql';
import {unwrapResult} from '@/lib/types';
import type {CustomerAddress, CustomerOrderSummary, OrderDetail} from '@/lib/types';

/**
 * Account hooks.
 *
 * Everything here is customer-scoped: `useAuthToken: true` on every call, keys
 * under the `customer` root so sign-out drops them, and never persisted to
 * MMKV. Order history on an unencrypted store would be a real privacy leak on
 * a shared device.
 */

const AUTH = {useAuthToken: true} as const;

export interface OrdersParams {
    take?: number;
    skip?: number;
}

export interface OrdersResult {
    orders: CustomerOrderSummary[];
    totalItems: number;
}

export function useOrders(params: OrdersParams = {}): UseQueryResult<OrdersResult, Error> {
    const {take = 20, skip = 0} = params;

    return useQuery({
        queryKey: queryKeys.orders({take, skip}),
        queryFn: async ({signal}) => {
            const {data} = await query(
                GetCustomerOrdersQuery,
                {options: {take, skip, sort: {createdAt: 'DESC' as const}}},
                {...AUTH, signal},
            );
            const orders = data.activeCustomer?.orders;
            return {orders: orders?.items ?? [], totalItems: orders?.totalItems ?? 0};
        },
    });
}

/**
 * A single order by code.
 *
 * Also serves the post-checkout confirmation screen, where the customer may
 * still be a guest, so this does not require a signed-in session: Vendure
 * authorises `orderByCode` against the active session token for a recently
 * placed order.
 */
export function useOrder(code: string | undefined): UseQueryResult<OrderDetail | null, Error> {
    return useQuery({
        queryKey: queryKeys.order(code ?? ''),
        enabled: Boolean(code),
        queryFn: async ({signal}) => {
            const {data} = await query(GetOrderDetailQuery, {code: code as string}, {...AUTH, signal});
            return data.orderByCode ?? null;
        },
    });
}

export function useAddresses(): UseQueryResult<CustomerAddress[], Error> {
    return useQuery({
        queryKey: queryKeys.addresses(),
        queryFn: async ({signal}) => {
            const {data} = await query(GetCustomerAddressesQuery, {}, {...AUTH, signal});
            return data.activeCustomer?.addresses ?? [];
        },
    });
}

export type CreateAddressInput = VariablesOf<typeof CreateCustomerAddressMutation>['input'];
export type UpdateAddressInput = VariablesOf<typeof UpdateCustomerAddressMutation>['input'];

export function useCreateAddress() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: ['account', 'create-address'],
        mutationFn: async (input: CreateAddressInput) => {
            const {data} = await mutate(CreateCustomerAddressMutation, {input}, AUTH);
            return data.createCustomerAddress;
        },
        onSuccess: () => {
            void client.invalidateQueries({queryKey: queryKeys.addresses()});
        },
    });
}

export function useUpdateAddress() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: ['account', 'update-address'],
        mutationFn: async (input: UpdateAddressInput) => {
            const {data} = await mutate(UpdateCustomerAddressMutation, {input}, AUTH);
            return data.updateCustomerAddress;
        },
        onSuccess: () => {
            void client.invalidateQueries({queryKey: queryKeys.addresses()});
        },
    });
}

export function useDeleteAddress() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: ['account', 'delete-address'],
        mutationFn: async (id: string) => {
            const {data} = await mutate(DeleteCustomerAddressMutation, {id}, AUTH);
            return data.deleteCustomerAddress;
        },
        // Optimistic: an address disappearing on tap is unambiguous, and the
        // list is re-read on settle either way.
        onMutate: async (id: string) => {
            await client.cancelQueries({queryKey: queryKeys.addresses()});
            const previous = client.getQueryData<CustomerAddress[]>(queryKeys.addresses());
            client.setQueryData<CustomerAddress[]>(
                queryKeys.addresses(),
                (previous ?? []).filter(address => address.id !== id),
            );
            return {previous};
        },
        onError: (_error, _id, context) => {
            if (context?.previous) client.setQueryData(queryKeys.addresses(), context.previous);
        },
        onSettled: () => {
            void client.invalidateQueries({queryKey: queryKeys.addresses()});
        },
    });
}

export type UpdateCustomerInput = VariablesOf<typeof UpdateCustomerMutation>['input'];

export function useUpdateProfile() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: ['account', 'update-profile'],
        mutationFn: async (input: UpdateCustomerInput) => {
            const {data} = await mutate(UpdateCustomerMutation, {input}, AUTH);
            return data.updateCustomer;
        },
        onSuccess: () => {
            void client.invalidateQueries({queryKey: queryKeys.activeCustomer()});
        },
    });
}

export function useUpdatePassword() {
    return useMutation({
        mutationKey: ['account', 'update-password'],
        mutationFn: async ({
            currentPassword,
            newPassword,
        }: {
            currentPassword: string;
            newPassword: string;
        }) => {
            const {data} = await mutate(
                UpdateCustomerPasswordMutation,
                {currentPassword, newPassword},
                AUTH,
            );
            return unwrapResult(data.updateCustomerPassword);
        },
    });
}

/** Shipping countries. Public catalogue data, so it is cached and persisted. */
export function useAvailableCountries() {
    return useQuery({
        queryKey: queryKeys.countries(),
        queryFn: async ({signal}) => {
            const {data} = await query(GetAvailableCountriesQuery, {}, {signal});
            return data.availableCountries;
        },
        staleTime: 24 * 60 * 60 * 1000,
    });
}

export type {CustomerAddress, CustomerOrderSummary, OrderDetail};
