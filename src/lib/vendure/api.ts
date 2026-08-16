import type {TadaDocumentNode} from 'gql.tada';
import {print} from 'graphql';
import {env} from '@/lib/env';
import {getAuthToken, setAuthToken} from '@/lib/auth/token-store';

/**
 * Vendure Shop API client.
 *
 * Deliberately kept call-compatible with the web storefront's
 * `src/lib/vendure/api.ts` so the ~2200 lines of GraphQL documents copied from
 * it work unchanged. Two things differ, both forced by the platform:
 *
 * 1. **Session persistence.** The web app rides on cookies the browser manages.
 *    React Native has no cookie jar we want to depend on, so Vendure's
 *    `vendure-auth-token` bearer token is stored in the device keychain via
 *    expo-secure-store and attached manually.
 * 2. **No `next` cache options.** Caching is TanStack Query's job here, so the
 *    `tags` / `revalidate` surface is gone rather than stubbed.
 */

const AUTH_TOKEN_HEADER = 'vendure-auth-token';
const CHANNEL_TOKEN_HEADER = 'vendure-token';

export interface VendureRequestOptions {
    /** Explicit bearer token; falls back to the stored session when `useAuthToken`. */
    token?: string;
    /** Attach the stored session token. Required for anything customer-scoped. */
    useAuthToken?: boolean;
    channelToken?: string;
    languageCode?: string;
    currencyCode?: string;
    signal?: AbortSignal;
}

interface VendureResponse<T> {
    data?: T;
    errors?: Array<{message: string; [key: string]: unknown}>;
}

/**
 * A failure that is about reachability rather than the request itself.
 * The UI distinguishes these: a network blip deserves a retry button, a
 * GraphQL error does not.
 */
export class ServerUnreachableError extends Error {
    constructor(message = 'Could not reach the store. Check your connection.') {
        super(message);
        this.name = 'ServerUnreachableError';
    }
}

export class VendureApiError extends Error {
    readonly errors: Array<{message: string; [key: string]: unknown}>;

    constructor(errors: Array<{message: string; [key: string]: unknown}>) {
        super(errors.map(e => e.message).join(', '));
        this.name = 'VendureApiError';
        this.errors = errors;
    }
}

function isGatewayStatus(status: number): boolean {
    return status === 502 || status === 503 || status === 504;
}

async function request<TResult>(
    document: TadaDocumentNode<TResult, unknown>,
    variables: unknown,
    options: VendureRequestOptions = {},
): Promise<{data: TResult; token?: string}> {
    const {token, useAuthToken, channelToken, languageCode, currencyCode, signal} = options;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        [CHANNEL_TOKEN_HEADER]: channelToken ?? env.vendureChannelToken,
    };

    let authToken = token;
    if (useAuthToken && !authToken) {
        authToken = (await getAuthToken()) ?? undefined;
    }
    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    // Vendure takes language/currency as query params, not headers.
    const url = new URL(env.vendureShopApiUrl);
    if (languageCode) url.searchParams.set('languageCode', languageCode);
    if (currencyCode) url.searchParams.set('currencyCode', currencyCode);

    let response: Response;
    try {
        response = await fetch(url.toString(), {
            method: 'POST',
            headers,
            body: JSON.stringify({query: print(document), variables: variables ?? {}}),
            signal,
        });
    } catch (error) {
        // AbortError is a caller decision, not a server problem; let it through
        // so TanStack Query can tell a cancellation from a failure.
        if (error instanceof Error && error.name === 'AbortError') throw error;
        throw new ServerUnreachableError();
    }

    if (!response.ok) {
        if (isGatewayStatus(response.status)) throw new ServerUnreachableError();
        throw new Error(`Vendure API returned HTTP ${response.status}`);
    }

    let result: VendureResponse<TResult>;
    try {
        result = (await response.json()) as VendureResponse<TResult>;
    } catch {
        throw new ServerUnreachableError('The store returned a malformed response.');
    }

    if (result.errors?.length) throw new VendureApiError(result.errors);
    if (!result.data) throw new Error('Vendure API returned no data');

    // Vendure rotates the session token on login, register and guest-order
    // creation. Persisting it here means callers never have to remember to.
    const newToken = response.headers.get(AUTH_TOKEN_HEADER);
    if (newToken && newToken !== authToken) {
        await setAuthToken(newToken);
    }

    return {data: result.data, ...(newToken ? {token: newToken} : {})};
}

export async function query<TResult, TVariables>(
    document: TadaDocumentNode<TResult, TVariables>,
    ...[variables, options]: TVariables extends Record<string, never>
        ? [variables?: TVariables, options?: VendureRequestOptions]
        : [variables: TVariables, options?: VendureRequestOptions]
): Promise<{data: TResult; token?: string}> {
    return request(
        document as TadaDocumentNode<TResult, unknown>,
        variables,
        options as VendureRequestOptions,
    );
}

/** GraphQL makes no transport distinction; this exists for call-site clarity. */
export async function mutate<TResult, TVariables>(
    document: TadaDocumentNode<TResult, TVariables>,
    ...[variables, options]: TVariables extends Record<string, never>
        ? [variables?: TVariables, options?: VendureRequestOptions]
        : [variables: TVariables, options?: VendureRequestOptions]
): Promise<{data: TResult; token?: string}> {
    return request(
        document as TadaDocumentNode<TResult, unknown>,
        variables,
        options as VendureRequestOptions,
    );
}
