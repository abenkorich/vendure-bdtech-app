import {useCallback} from 'react';
import {useMutation, useQuery, useQueryClient, type UseQueryResult} from '@tanstack/react-query';
import {query, mutate} from '@/lib/vendure/api';
import {queryKeys, CUSTOMER_ROOT} from '@/lib/query-keys';
import {GetActiveCustomerQuery} from '@/lib/vendure/queries';
import {
    LoginMutation,
    LogoutMutation,
    RegisterCustomerAccountMutation,
    RequestPasswordResetMutation,
    ResetPasswordMutation,
} from '@/lib/vendure/mutations';
import {getAuthToken, clearAuthToken} from '@/lib/auth/token-store';
import {readFragment} from '@/graphql';
import {ActiveCustomerFragment} from '@/lib/vendure/fragments';
import type {ResultOf} from '@/graphql';
import {unwrapResult, VendureResultError} from '@/lib/types';

/**
 * Session hooks.
 *
 * "Signed in" is derived from `activeCustomer` resolving, never from the mere
 * presence of a token. A Vendure session token outlives its server-side
 * session, so trusting the token alone produces an app that shows an account
 * screen and then 401s on everything inside it.
 */

export type SessionCustomer = ResultOf<typeof ActiveCustomerFragment>;

export interface Session {
    customer: SessionCustomer | null;
    isSignedIn: boolean;
    isLoading: boolean;
    /** True while re-checking in the background with a customer already shown. */
    isRefetching: boolean;
    error: Error | null;
    refetch: () => Promise<unknown>;
}

async function fetchActiveCustomer(signal?: AbortSignal): Promise<SessionCustomer | null> {
    // No token means guest; skip a round-trip that can only answer null.
    const token = await getAuthToken();
    if (!token) return null;

    const {data} = await query(GetActiveCustomerQuery, {}, {useAuthToken: true, signal});
    if (!data.activeCustomer) {
        // The token is stale. Dropping it here keeps every later request from
        // re-attempting a session the server has already forgotten.
        await clearAuthToken();
        return null;
    }
    return readFragment(ActiveCustomerFragment, data.activeCustomer);
}

export function useActiveCustomer(): UseQueryResult<SessionCustomer | null, Error> {
    return useQuery({
        queryKey: queryKeys.activeCustomer(),
        queryFn: ({signal}) => fetchActiveCustomer(signal),
        // Identity is cheap to hold and expensive to get wrong; re-verify on
        // a slower cadence than the catalogue.
        staleTime: 2 * 60 * 1000,
    });
}

export function useSession(): Session {
    const result = useActiveCustomer();
    return {
        customer: result.data ?? null,
        isSignedIn: Boolean(result.data),
        isLoading: result.isPending,
        isRefetching: result.isFetching && !result.isPending,
        error: result.error,
        refetch: result.refetch,
    };
}

export interface SignInInput {
    username: string;
    password: string;
}

/**
 * Sign in.
 *
 * `api.ts` persists the rotated `vendure-auth-token` header, and
 * `startAuthCacheSync` drops the customer subtree on that transition, so this
 * hook only has to re-seed the identity query. It deliberately awaits the
 * refetch: navigating to an account screen that then flickers to "signed out"
 * is worse than a spinner on the button for one round-trip.
 */
export function useSignIn() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: [CUSTOMER_ROOT, 'sign-in'],
        mutationFn: async ({username, password}: SignInInput) => {
            const {data} = await mutate(LoginMutation, {username, password});
            return unwrapResult(data.login);
        },
        onSuccess: async () => {
            await client.refetchQueries({queryKey: queryKeys.activeCustomer()});
            // The guest cart is merged into the customer's on login; the
            // server's answer is authoritative, so re-read rather than guess.
            await client.invalidateQueries({queryKey: queryKeys.activeOrder()});
        },
    });
}

/**
 * Sign out.
 *
 * The local token is cleared even when the server call fails. A failed logout
 * that leaves the user apparently signed in is the worse outcome: on a shared
 * phone with no connectivity it hands the next person an open account.
 */
export function useSignOut() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: [CUSTOMER_ROOT, 'sign-out'],
        mutationFn: async () => {
            try {
                await mutate(LogoutMutation, {}, {useAuthToken: true});
            } finally {
                await clearAuthToken();
            }
        },
        onSettled: () => {
            // Belt and braces: startAuthCacheSync already fires on the token
            // change, but sign-out must not depend on a listener being wired.
            client.removeQueries({queryKey: [CUSTOMER_ROOT]});
        },
    });
}

export interface RegisterInput {
    emailAddress: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
}

/**
 * Register.
 *
 * Returns `{requiresVerification}`: this channel emails a verification link, so
 * a successful registration does **not** produce a signed-in session. A screen
 * that navigates straight to the account hub on success will show a guest.
 */
export function useRegister() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: [CUSTOMER_ROOT, 'register'],
        mutationFn: async (input: RegisterInput) => {
            const {data} = await mutate(RegisterCustomerAccountMutation, {input});
            unwrapResult(data.registerCustomerAccount);
            const customer = await fetchActiveCustomer();
            return {requiresVerification: customer === null, customer};
        },
        onSuccess: result => {
            client.setQueryData(queryKeys.activeCustomer(), result.customer);
        },
    });
}

export function useRequestPasswordReset() {
    return useMutation({
        mutationKey: [CUSTOMER_ROOT, 'request-password-reset'],
        mutationFn: async (emailAddress: string) => {
            const {data} = await mutate(RequestPasswordResetMutation, {emailAddress});
            return unwrapResult(data.requestPasswordReset);
        },
    });
}

export function useResetPassword() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: [CUSTOMER_ROOT, 'reset-password'],
        mutationFn: async ({token, password}: {token: string; password: string}) => {
            const {data} = await mutate(ResetPasswordMutation, {token, password});
            return unwrapResult(data.resetPassword);
        },
        onSuccess: async () => {
            await client.refetchQueries({queryKey: queryKeys.activeCustomer()});
        },
    });
}

/** Human-readable message for an auth failure, for screens to surface. */
export function useAuthErrorMessage(): (error: unknown) => string | null {
    return useCallback((error: unknown) => {
        if (error instanceof VendureResultError) return error.message;
        if (error instanceof Error) return error.message;
        return null;
    }, []);
}

export {VendureResultError};
