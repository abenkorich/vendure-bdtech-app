import {
    useMutation,
    useQuery,
    useQueryClient,
    type QueryClient,
    type UseQueryResult,
} from '@tanstack/react-query';
import {query, mutate} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import {GetActiveOrderQuery, GetActiveOrderForCheckoutQuery} from '@/lib/vendure/queries';
import {
    AddToCartMutation,
    AdjustCartItemMutation,
    RemoveFromCartMutation,
    ApplyPromotionCodeMutation,
    RemovePromotionCodeMutation,
} from '@/lib/vendure/mutations';
import {unwrapResult} from '@/lib/types';
import type {CheckoutOrder} from '@/lib/types';
import {
    addToCartOptimistic,
    adjustLineQuantity,
    removeLine,
    cartCount,
    type CartOrder,
} from '@/lib/cart-math';

/**
 * Cart hooks.
 *
 * Every mutation is optimistic. Tapping "+" on a quantity stepper must move the
 * number on the same frame — this store's customers are on Algerian mobile
 * data, where a round-trip is routinely several hundred milliseconds, and a
 * stepper that lags feels broken and gets tapped again.
 *
 * The standard shape throughout: cancel in-flight reads, snapshot, write the
 * predicted cart, roll back on error, invalidate on settle so the server always
 * gets the last word (stock limits and promotions can only be decided there).
 *
 * The active order is customer-scoped and is therefore never persisted to MMKV.
 */

const AUTH = {useAuthToken: true} as const;

async function fetchActiveOrder(signal?: AbortSignal): Promise<CartOrder | null> {
    const {data} = await query(GetActiveOrderQuery, {}, {...AUTH, signal});
    return data.activeOrder ?? null;
}

export function useActiveOrder(): UseQueryResult<CartOrder | null, Error> {
    return useQuery({
        queryKey: queryKeys.activeOrder(),
        queryFn: ({signal}) => fetchActiveOrder(signal),
        // A cart is the one thing that must not be shown stale: it is the
        // number the customer is about to pay.
        staleTime: 0,
        refetchOnMount: 'always',
    });
}

/** The wider order document checkout needs (addresses, shipping lines). */
export function useCheckoutOrder(): UseQueryResult<CheckoutOrder | null, Error> {
    return useQuery({
        queryKey: queryKeys.activeOrderForCheckout(),
        queryFn: async ({signal}) => {
            const {data} = await query(GetActiveOrderForCheckoutQuery, {}, {...AUTH, signal});
            return data.activeOrder ?? null;
        },
        staleTime: 0,
    });
}

/** Item count for the cart tab badge, without subscribing to the whole order. */
export function useCartCount(): number {
    const {data} = useActiveOrder();
    return cartCount(data);
}

interface CartContext {
    previous: CartOrder | null | undefined;
}

/**
 * Shared optimistic plumbing.
 *
 * `cancelQueries` first is not optional: an active-order refetch that resolves
 * after the optimistic write would overwrite it with pre-tap data, and the
 * quantity would visibly jump back.
 */
async function beginOptimistic(
    client: QueryClient,
    apply: (current: CartOrder | null) => CartOrder | null,
): Promise<CartContext> {
    await client.cancelQueries({queryKey: queryKeys.activeOrder()});
    const previous = client.getQueryData<CartOrder | null>(queryKeys.activeOrder());
    client.setQueryData<CartOrder | null>(queryKeys.activeOrder(), apply(previous ?? null));
    return {previous};
}

function rollback(client: QueryClient, context: CartContext | undefined): void {
    if (!context) return;
    client.setQueryData(queryKeys.activeOrder(), context.previous);
}

function settleCart(client: QueryClient): void {
    void client.invalidateQueries({queryKey: queryKeys.activeOrder()});
    void client.invalidateQueries({queryKey: queryKeys.activeOrderForCheckout()});
}

export interface AddToCartInput {
    variantId: string;
    quantity?: number;
}

/**
 * Add to cart.
 *
 * Adds a variant already in the cart as an exact quantity bump; a genuinely new
 * line only moves the badge until the server answers. See `cart-math.ts` for
 * why no placeholder line is invented.
 */
export function useAddToCart() {
    const client = useQueryClient();

    return useMutation<unknown, Error, AddToCartInput, CartContext>({
        mutationKey: ['cart', 'add'],
        mutationFn: async ({variantId, quantity = 1}) => {
            const {data} = await mutate(AddToCartMutation, {variantId, quantity}, AUTH);
            // Vendure reports OrderLimitError / InsufficientStockError as data,
            // not as a GraphQL error. Unwrapping turns it into a throw, which
            // is what triggers the rollback below.
            return unwrapResult(data.addItemToOrder);
        },
        onMutate: ({variantId, quantity = 1}) =>
            beginOptimistic(client, current => addToCartOptimistic(current, variantId, quantity)),
        onError: (_error, _input, context) => rollback(client, context),
        onSettled: () => settleCart(client),
    });
}

export interface AdjustLineInput {
    lineId: string;
    quantity: number;
}

/** Set a line's quantity. Zero removes the line, matching Vendure's behaviour. */
export function useAdjustLine() {
    const client = useQueryClient();

    return useMutation<unknown, Error, AdjustLineInput, CartContext>({
        mutationKey: ['cart', 'adjust'],
        mutationFn: async ({lineId, quantity}) => {
            const {data} = await mutate(AdjustCartItemMutation, {lineId, quantity}, AUTH);
            return unwrapResult(data.adjustOrderLine);
        },
        onMutate: ({lineId, quantity}) =>
            beginOptimistic(client, current =>
                current ? adjustLineQuantity(current, lineId, quantity) : current,
            ),
        onError: (_error, _input, context) => rollback(client, context),
        onSettled: () => settleCart(client),
    });
}

export function useRemoveLine() {
    const client = useQueryClient();

    return useMutation<unknown, Error, {lineId: string}, CartContext>({
        mutationKey: ['cart', 'remove'],
        mutationFn: async ({lineId}) => {
            const {data} = await mutate(RemoveFromCartMutation, {lineId}, AUTH);
            return unwrapResult(data.removeOrderLine);
        },
        onMutate: ({lineId}) =>
            beginOptimistic(client, current => (current ? removeLine(current, lineId) : current)),
        onError: (_error, _input, context) => rollback(client, context),
        onSettled: () => settleCart(client),
    });
}

/**
 * Apply a coupon. Deliberately **not** optimistic: only the server knows what a
 * promotion is worth, and a discount that appears and then vanishes is a worse
 * experience than one that takes a moment to arrive.
 */
export function useApplyCoupon() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: ['cart', 'apply-coupon'],
        mutationFn: async (couponCode: string) => {
            const {data} = await mutate(ApplyPromotionCodeMutation, {couponCode}, AUTH);
            return unwrapResult(data.applyCouponCode);
        },
        onSettled: () => settleCart(client),
    });
}

export function useRemoveCoupon() {
    const client = useQueryClient();

    return useMutation({
        mutationKey: ['cart', 'remove-coupon'],
        mutationFn: async (couponCode: string) => {
            const {data} = await mutate(RemovePromotionCodeMutation, {couponCode}, AUTH);
            return data.removeCouponCode;
        },
        onSettled: () => settleCart(client),
    });
}

export {cartCount};
