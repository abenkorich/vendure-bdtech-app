import {ServerUnreachableError} from '@/lib/vendure/api';
import {VendureResultError} from '@/lib/types';
import {CART_STRINGS} from './strings';

/**
 * Error presentation.
 *
 * The distinction that matters at the till: a network blip is worth a retry
 * button, a rejected coupon or an out-of-stock line is not — retrying it just
 * fails again, and a vague "something went wrong" over a real Vendure message
 * ("Coupon code is not valid") is what turns a recoverable problem into an
 * abandoned cart.
 */

export interface PresentedError {
    message: string;
    /** True only for reachability failures, where retrying can succeed. */
    retryable: boolean;
}

export function presentError(error: unknown): PresentedError {
    if (error instanceof ServerUnreachableError) {
        return {message: CART_STRINGS.serverUnreachableBody, retryable: true};
    }

    // A Vendure ErrorResult carries copy written for the customer
    // (InsufficientStockError, CouponCodeInvalidError...). Show it verbatim.
    if (error instanceof VendureResultError) {
        return {message: error.message, retryable: false};
    }

    if (error instanceof Error && error.message) {
        return {message: error.message, retryable: false};
    }

    return {message: CART_STRINGS.somethingWentWrong, retryable: false};
}
