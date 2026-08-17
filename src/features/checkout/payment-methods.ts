import type {IconName} from '@/components/ui';

/**
 * Payment method registry.
 *
 * Today this store takes cash on delivery and nothing else. That is not a
 * simplification of the checkout, it is the Algerian market: the card network
 * (SATIM / CIB / Edahabia) is a separate integration with its own hosted
 * redirect, and it is not live on this backend.
 *
 * The point of this file is that adding it later is *adding a row here*, not
 * restructuring the payment step. Everything the step needs to render and
 * complete a method is described by `PaymentMethodPresentation`:
 *
 *   - `kind: 'immediate'` — nothing to collect, the order is placed directly
 *     (every COD method).
 *   - `kind: 'redirect'` — the method hands off to a payment page and comes
 *     back; SATIM will be this. The step must not assume `immediate`, which is
 *     why the discriminant exists before there is a second member... and why
 *     `describe()` returns a shape rather than a boolean.
 *
 * Codes come from the live backend (verified): `yalidine-cod`, `zrexpress-cod`,
 * `dhd-cod`, `country-resident-cod`. `pos-*` methods are eligible on the Shop
 * API too but belong to the in-store register, and offering "Cash at POS" to a
 * customer on their phone would be nonsense, so they are filtered out.
 */

export type PaymentKind = 'immediate' | 'redirect';

export interface PaymentMethodPresentation {
    kind: PaymentKind;
    icon: IconName;
    /** Message key under `Checkout.` describing what happens next. Optional. */
    hintKey?: string;
}

/** Method codes that must never be offered in the customer-facing app. */
const POS_ONLY_PREFIX = 'pos-';

const COD_PRESENTATION: PaymentMethodPresentation = {
    kind: 'immediate',
    icon: 'cash',
    hintKey: 'codHint',
};

/**
 * How to present a method code.
 *
 * Unknown codes deliberately fall back to `immediate` with a neutral icon
 * rather than being hidden: a payment method the backend says is eligible and
 * the app refuses to show is an order that cannot be placed, with no
 * explanation anywhere.
 */
export function describePaymentMethod(code: string): PaymentMethodPresentation {
    if (isCashOnDelivery(code)) return COD_PRESENTATION;
    return {kind: 'immediate', icon: 'creditCard'};
}

export function isCashOnDelivery(code: string): boolean {
    return code.endsWith('-cod') || code === 'cod';
}

/** Drop the register-only methods from an eligible list. */
export function isCustomerFacingPaymentMethod(code: string): boolean {
    return !code.startsWith(POS_ONLY_PREFIX);
}
