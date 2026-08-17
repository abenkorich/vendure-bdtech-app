import {useMutation, useQueryClient} from '@tanstack/react-query';
import {mutate, query} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import {
    TransitionOrderToStateMutation,
    AddPaymentToOrderMutation,
} from '@/lib/vendure/mutations';
import {GetActiveOrderForCheckoutQuery} from '@/lib/vendure/queries';
import {unwrapResult, VendureResultError} from '@/lib/types';

/**
 * Placing the order.
 *
 * This is the only irreversible action in the app, so it is deliberately the
 * one place that re-reads the order from the server before acting rather than
 * trusting the screen's props. A stale cache here would place an order for the
 * wrong total.
 *
 * The sequence is Vendure's, and both halves must succeed:
 *
 *   1. `AddingItems -> ArrangingPayment`. This is where the backend re-checks
 *      stock and product availability, so it is where "that item sold out
 *      while you were typing your address" surfaces.
 *   2. `addPaymentToOrder`. For a COD method the handler settles it without a
 *      gateway; nothing is charged to a card, the courier collects cash.
 *
 * `OrderStateTransitionError.transitionError` is preferred over `message`
 * because Vendure's `message` for a transition is the generic
 * "Cannot transition from AddingItems to ArrangingPayment", while
 * `transitionError` carries the reason a customer can act on.
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

            const transition = await mutate(
                TransitionOrderToStateMutation,
                {state: 'ArrangingPayment'},
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

            const payment = await mutate(
                AddPaymentToOrderMutation,
                {input: {method: paymentMethodCode, metadata: {}}},
                AUTH,
            );

            let paid;
            try {
                paid = unwrapResult(payment.data.addPaymentToOrder);
            } catch (caught) {
                throw new PlaceOrderError(
                    'PAYMENT_FAILED',
                    caught instanceof VendureResultError
                        ? caught.message
                        : 'The payment could not be recorded.',
                );
            }

            return {code: paid.code, state: paid.state};
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
