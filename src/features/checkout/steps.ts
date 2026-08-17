/**
 * The checkout step machine.
 *
 * Pure, and separate from the screen, for two reasons. It is the part with real
 * rules — which step is reachable, what a change invalidates — and it is the
 * part a Node test can reach (see AGENTS.md: anything importing React Native
 * cannot be bundled by `tests/run.mjs`).
 *
 * The rule that drives everything: **a later step's validity is derived from
 * the order, never remembered.** Changing the address after picking a Yalidine
 * stop-desk must un-pick it, because the eligible methods for the new wilaya
 * are a different list and the previously chosen id may not be in it. A flow
 * that only tracks "completed steps" forward is exactly how a customer ends up
 * with a delivery method that does not serve their address.
 */

export type CheckoutStep = 'contact' | 'address' | 'delivery' | 'payment' | 'review';

export const GUEST_STEPS: readonly CheckoutStep[] = [
    'contact',
    'address',
    'delivery',
    'payment',
    'review',
];

/** A signed-in customer's contact details are already on the order. */
export const SIGNED_IN_STEPS: readonly CheckoutStep[] = [
    'address',
    'delivery',
    'payment',
    'review',
];

export function stepsFor(isGuest: boolean): readonly CheckoutStep[] {
    return isGuest ? GUEST_STEPS : SIGNED_IN_STEPS;
}

/** The order fields each step depends on, as read off `CheckoutOrder`. */
export interface OrderProgress {
    hasCustomer: boolean;
    hasShippingAddress: boolean;
    hasShippingMethod: boolean;
    /** Selected locally: a payment method is not stored on the order until it
     * is paid, so this one piece of state has nowhere else to live. */
    hasPaymentMethod: boolean;
}

export function progressOf(order: {
    customer?: {emailAddress?: string | null} | null;
    shippingAddress?: {streetLine1?: string | null; country?: string | null} | null;
    shippingLines?: readonly unknown[] | null;
} | null | undefined, paymentMethodCode: string | null): OrderProgress {
    return {
        hasCustomer: Boolean(order?.customer?.emailAddress),
        hasShippingAddress: Boolean(
            order?.shippingAddress?.streetLine1 && order?.shippingAddress?.country,
        ),
        hasShippingMethod: Boolean(order?.shippingLines?.length),
        hasPaymentMethod: Boolean(paymentMethodCode),
    };
}

/** Whether a step's own requirement is satisfied. */
export function isStepComplete(step: CheckoutStep, progress: OrderProgress): boolean {
    switch (step) {
        case 'contact':
            return progress.hasCustomer;
        case 'address':
            return progress.hasShippingAddress;
        case 'delivery':
            return progress.hasShippingMethod;
        case 'payment':
            return progress.hasPaymentMethod;
        case 'review':
            return false;
    }
}

/**
 * Whether a step can be opened.
 *
 * Every preceding step must be complete, not just the immediately previous one.
 * Jumping back to the address and then tapping "Review" must not skip the
 * delivery step whose selection the address change invalidated.
 */
export function canAccessStep(
    step: CheckoutStep,
    steps: readonly CheckoutStep[],
    progress: OrderProgress,
): boolean {
    const index = steps.indexOf(step);
    if (index <= 0) return true;
    return steps.slice(0, index).every(previous => isStepComplete(previous, progress));
}

/** The furthest step the order's own state justifies opening. */
export function resolveCurrentStep(
    steps: readonly CheckoutStep[],
    progress: OrderProgress,
): CheckoutStep {
    for (const step of steps) {
        if (!isStepComplete(step, progress)) return step;
    }
    return 'review';
}

/** The step after `step`, or null at the end of the flow. */
export function nextStep(
    step: CheckoutStep,
    steps: readonly CheckoutStep[],
): CheckoutStep | null {
    const index = steps.indexOf(step);
    if (index < 0 || index >= steps.length - 1) return null;
    return steps[index + 1];
}

/** Everything blocking the final confirm, in the order it should be fixed. */
export function placeOrderBlockers(progress: OrderProgress): CheckoutStep[] {
    const blockers: CheckoutStep[] = [];
    if (!progress.hasCustomer) blockers.push('contact');
    if (!progress.hasShippingAddress) blockers.push('address');
    if (!progress.hasShippingMethod) blockers.push('delivery');
    if (!progress.hasPaymentMethod) blockers.push('payment');
    return blockers;
}
