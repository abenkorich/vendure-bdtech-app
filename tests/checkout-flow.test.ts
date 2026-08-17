import assert from 'node:assert/strict';
import {
    canAccessStep,
    isStepComplete,
    placeOrderBlockers,
    progressOf,
    resolveCurrentStep,
    stepsFor,
    nextStep,
    GUEST_STEPS,
    SIGNED_IN_STEPS,
} from '../src/features/checkout/steps';
import {
    deliveryModeOf,
    groupDeliveryMethods,
    plainDescription,
    requiresPickupCenter,
} from '../src/features/checkout/delivery';
import {
    describePaymentMethod,
    isCashOnDelivery,
    isCustomerFacingPaymentMethod,
} from '../src/features/checkout/payment-methods';

/**
 * Checkout rules.
 *
 * The two things worth guarding here are the ones that silently produce a
 * *deliverable-looking* but wrong order: a step machine that lets someone reach
 * "place order" without a shipping method, and a delivery classifier that
 * treats a stop-desk as a home delivery (or vice versa). Both would type-check
 * happily.
 *
 * Codes and prices below are the real ones read off api.dzduino.dz.
 */

const NOTHING = progressOf(null, null);

const FULL = progressOf(
    {
        customer: {emailAddress: 'qa@example.test'},
        shippingAddress: {streetLine1: '12 Rue Didouche Mourad', country: 'Algeria'},
        shippingLines: [{}],
    },
    'yalidine-cod',
);

function testProgress(): void {
    assert.deepEqual(NOTHING, {
        hasCustomer: false,
        hasShippingAddress: false,
        hasShippingMethod: false,
        hasPaymentMethod: false,
    });

    assert.equal(FULL.hasCustomer, true);
    assert.equal(FULL.hasShippingAddress, true);
    assert.equal(FULL.hasShippingMethod, true);
    assert.equal(FULL.hasPaymentMethod, true);

    // A half-written address is not an address: Vendure accepts a shipping
    // address with no street, and the courier cannot deliver to it.
    const partial = progressOf(
        {shippingAddress: {streetLine1: '', country: 'Algeria'}},
        null,
    );
    assert.equal(partial.hasShippingAddress, false);
}

function testStepOrder(): void {
    assert.deepEqual(stepsFor(true), GUEST_STEPS);
    assert.deepEqual(stepsFor(false), SIGNED_IN_STEPS);
    // A signed-in customer must not be asked for contact details again.
    assert.equal(SIGNED_IN_STEPS.includes('contact' as never), false);

    assert.equal(nextStep('contact', GUEST_STEPS), 'address');
    assert.equal(nextStep('review', GUEST_STEPS), null);
}

function testAccess(): void {
    // The first step is always reachable, everything else is earned.
    assert.equal(canAccessStep('contact', GUEST_STEPS, NOTHING), true);
    assert.equal(canAccessStep('address', GUEST_STEPS, NOTHING), false);
    assert.equal(canAccessStep('review', GUEST_STEPS, NOTHING), false);

    // The regression this exists for: contact and address done, delivery not.
    // "Review" must stay closed even though the step *before* it (payment) is
    // not what is missing.
    const noDelivery = progressOf(
        {
            customer: {emailAddress: 'qa@example.test'},
            shippingAddress: {streetLine1: '12 Rue', country: 'Algeria'},
            shippingLines: [],
        },
        'yalidine-cod',
    );
    assert.equal(canAccessStep('delivery', GUEST_STEPS, noDelivery), true);
    assert.equal(canAccessStep('review', GUEST_STEPS, noDelivery), false);

    assert.equal(canAccessStep('review', GUEST_STEPS, FULL), true);
}

function testResolveCurrent(): void {
    assert.equal(resolveCurrentStep(GUEST_STEPS, NOTHING), 'contact');
    assert.equal(resolveCurrentStep(SIGNED_IN_STEPS, NOTHING), 'address');
    assert.equal(resolveCurrentStep(GUEST_STEPS, FULL), 'review');

    // Review is never "complete", so the flow parks there rather than falling
    // off the end.
    assert.equal(isStepComplete('review', FULL), false);
}

function testBlockers(): void {
    assert.deepEqual(placeOrderBlockers(FULL), []);
    assert.deepEqual(placeOrderBlockers(NOTHING), [
        'contact',
        'address',
        'delivery',
        'payment',
    ]);

    // Everything but the payment choice: exactly one blocker, and it names the
    // step the customer has to go back to.
    const noPayment = progressOf(
        {
            customer: {emailAddress: 'qa@example.test'},
            shippingAddress: {streetLine1: '12 Rue', country: 'Algeria'},
            shippingLines: [{}],
        },
        null,
    );
    assert.deepEqual(placeOrderBlockers(noPayment), ['payment']);
}

function testDeliveryClassification(): void {
    // Real codes from the live channel.
    assert.equal(deliveryModeOf('yalidine-stopdesk'), 'stopdesk');
    assert.equal(deliveryModeOf('zrexpress-stopdesk'), 'stopdesk');
    assert.equal(deliveryModeOf('dhd-stopdesk'), 'stopdesk');
    assert.equal(deliveryModeOf('yalidine-home'), 'home');
    assert.equal(deliveryModeOf('zrexpress-home'), 'home');
    assert.equal(deliveryModeOf('dhd-home'), 'home');
    // Collection from the shop is neither a stop-desk nor a delivery.
    assert.equal(deliveryModeOf('in-store-pickup'), 'pickup');

    // Only Yalidine can persist a chosen centre on this backend.
    assert.equal(requiresPickupCenter('yalidine-stopdesk'), true);
    assert.equal(requiresPickupCenter('zrexpress-stopdesk'), false);
    assert.equal(requiresPickupCenter('yalidine-home'), false);
    assert.equal(requiresPickupCenter(null), false);
}

function testDeliveryGrouping(): void {
    const methods = [
        {id: '8', name: 'In-store Pickup', code: 'in-store-pickup', priceWithTax: 0},
        {id: '2', name: 'Yalidine Stop Desk', code: 'yalidine-stopdesk', priceWithTax: 35000},
        {id: '6', name: 'ZREXPRESS Stop Desk', code: 'zrexpress-stopdesk', priceWithTax: 45000},
        {id: '3', name: 'DHD Home Delivery', code: 'dhd-home', priceWithTax: 50000},
        {id: '1', name: 'Yalidine Home Delivery', code: 'yalidine-home', priceWithTax: 60000},
    ];

    const groups = groupDeliveryMethods(methods);

    // Stop-desk first: it is the cheapest and the most used option here.
    assert.deepEqual(
        groups.map(group => group.mode),
        ['stopdesk', 'home', 'pickup'],
    );
    // Cheapest first inside a group.
    assert.deepEqual(groups[0].methods.map(m => m.code), [
        'yalidine-stopdesk',
        'zrexpress-stopdesk',
    ]);
    assert.deepEqual(groups[1].methods.map(m => m.code), ['dhd-home', 'yalidine-home']);

    // Every method lands in exactly one group; none is silently dropped.
    const total = groups.reduce((sum, group) => sum + group.methods.length, 0);
    assert.equal(total, methods.length);

    // An empty mode produces no empty section.
    assert.equal(groupDeliveryMethods([methods[0]]).length, 1);
}

function testDescriptionStripping(): void {
    // Descriptions arrive from the admin rich-text field as HTML.
    assert.equal(
        plainDescription('<p>Pickup from a Yalidine center</p>'),
        'Pickup from a Yalidine center',
    );
    assert.equal(plainDescription('a &amp; b'), 'a & b');
    assert.equal(plainDescription(null), '');
    assert.equal(plainDescription('<p>a</p>\n<p>b</p>'), 'a b');
}

function testPaymentRegistry(): void {
    assert.equal(isCashOnDelivery('yalidine-cod'), true);
    assert.equal(isCashOnDelivery('zrexpress-cod'), true);
    assert.equal(isCashOnDelivery('country-resident-cod'), true);
    assert.equal(isCashOnDelivery('satim'), false);

    assert.equal(describePaymentMethod('yalidine-cod').kind, 'immediate');
    assert.equal(describePaymentMethod('yalidine-cod').icon, 'cash');
    // An unknown (future) method is still offered rather than hidden, so an
    // eligible method never becomes an unplaceable order.
    assert.equal(describePaymentMethod('satim-cib').kind, 'immediate');

    // Register-only methods are eligible on the Shop API but must never be
    // offered to a customer on their phone.
    assert.equal(isCustomerFacingPaymentMethod('pos-cash'), false);
    assert.equal(isCustomerFacingPaymentMethod('pos-card-manual'), false);
    assert.equal(isCustomerFacingPaymentMethod('yalidine-cod'), true);
}

export async function run(): Promise<void> {
    testProgress();
    testStepOrder();
    testAccess();
    testResolveCurrent();
    testBlockers();
    testDeliveryClassification();
    testDeliveryGrouping();
    testDescriptionStripping();
    testPaymentRegistry();
}
