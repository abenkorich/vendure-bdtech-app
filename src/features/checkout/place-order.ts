import {useMutation, useQueryClient} from '@tanstack/react-query';
import {mutate, query} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import {
    TransitionOrderToStateMutation,
    SetOrderPaymentMethodMutation,
} from '@/lib/vendure/mutations';
import {GetActiveOrderForCheckoutQuery} from '@/lib/vendure/queries';

/**
 * Placing the order.
 *
 * This is the only irreversible action in the app, so it is deliberately the
 * one place that re-reads the order from the server before acting rather than
 * trusting the screen's props. A stale cache here would place an order for the
 * wrong total.
 *
 * The sequence is the storefront's, and both halves must succeed:
 *
 *   1. `setOrderCustomFields({paymentMethodCode})`. No payment is taken at
 *      checkout: the chosen method is stored on the order and the store records
 *      the money later (cash on delivery once shipped, transfers when they
 *      arrive). Vendure's `ArrangingPayment` / `addPaymentToOrder` step does not
 *      exist in this store's order process.
 *   2. `AddingItems -> Processing`. This is the transition that places the
 *      order, and where the backend re-checks stock, product availability and
 *      that the stored payment method is set and eligible. It is where "that
 *      item sold out while you were typing your address" surfaces.
 *
 * `OrderStateTransitionError.transitionError` is preferred over `message`
 * because Vendure's `message` for a transition is the generic
 * "Cannot transition from AddingItems to Processing", while `transitionError`
 * carries the reason a customer can act on.
 *
 * NOTE FOR ANYONE TESTING THIS AGAINST api.dzduino.dz: that backend is
 * production with live payment configuration. Exercise the flow up to the
 * confirm button and stop. This hook was written and type-checked but
 * deliberately never invoked against production.
 */

export type PlaceOrderErrorCode =
    | 'NO_ACTIVE_ORDER'
    | 'PRODUCTS_UNAVAILABLE'
    | 'TRANSITION_FAILED'
    | 'PAYMENT_FAILED';

export class PlaceOrderError extends Error {
    readonly code: PlaceOrderErrorCode;

    constructor(code: PlaceOrderErrorCode, message: string) {
        super(message);
        this.name = 'PlaceOrderError';
        this.code = code;
    }
}

const AUTH = {useAuthToken: true} as const;

export interface PlaceOrderInput {
    paymentMethodCode: string;
}

export interface PlacedOrder {
    code: string;
    state: string;
}

/** Text that means "the catalogue moved under this order", not "try again". */
const UNAVAILABLE_PATTERN = /no longer available|unavailable|insufficient stock|out of stock/i;

export function usePlaceOrder() {
    const client = useQueryClient();

    return useMutation<PlacedOrder, Error, PlaceOrderInput>({
        mutationKey: ['checkout', 'place-order'],
        mutationFn: async ({paymentMethodCode}) => {
            const {data: current} = await query(GetActiveOrderForCheckoutQuery, {}, AUTH);
            const order = current.activeOrder;

            if (!order || order.lines.length === 0) {
                throw new PlaceOrderError('NO_ACTIVE_ORDER', 'Your cart is empty.');
            }

            const method = await mutate(
                SetOrderPaymentMethodMutation,
                {input: {customFields: {paymentMethodCode}}},
                AUTH,
            );
            const withMethod = method.data.setOrderCustomFields;
            if (withMethod.__typename !== 'Order') {
                throw new PlaceOrderError(
                    'PAYMENT_FAILED',
                    withMethod.message || 'The payment method could not be saved.',
                );
            }

            const transition = await mutate(
                TransitionOrderToStateMutation,
                {state: 'Processing'},
                AUTH,
            );
            const transitioned = transition.data.transitionOrderToState;

            if (!transitioned) {
                throw new PlaceOrderError('NO_ACTIVE_ORDER', 'No active order.');
            }

            if (transitioned.__typename === 'OrderStateTransitionError') {
                const detail = transitioned.transitionError || transitioned.message;
                throw new PlaceOrderError(
                    UNAVAILABLE_PATTERN.test(detail) ? 'PRODUCTS_UNAVAILABLE' : 'TRANSITION_FAILED',
                    detail,
                );
            }

            return {code: transitioned.code, state: transitioned.state};
        },
        onSuccess: placed => {
            // The active order is gone (it became a placed order), and the new
            // order must be readable by code on the confirmation screen.
            void client.invalidateQueries({queryKey: queryKeys.activeOrder()});
            void client.invalidateQueries({queryKey: queryKeys.activeOrderForCheckout()});
            void client.invalidateQueries({queryKey: queryKeys.order(placed.code)});
            void client.invalidateQueries({queryKey: queryKeys.orders()});
        },
    });
}
