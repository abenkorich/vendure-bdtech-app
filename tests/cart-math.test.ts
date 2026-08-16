import assert from 'node:assert/strict';
import type {ActiveOrder} from '@/lib/types';
import {
    adjustLineQuantity,
    removeLine,
    addToCartOptimistic,
    findLineByVariant,
    recomputeTotals,
    cartCount,
} from '@/lib/cart-math';

/**
 * Optimistic cart arithmetic.
 *
 * These are the numbers the customer is about to pay, computed locally so a
 * tap registers on the same frame. Every value is integer minor units (DZD
 * centimes), so the assertions below are exact by construction: any rounding
 * that crept in would show as a failure here rather than as a total that is
 * off by one centime on a real cart.
 */

function order(): ActiveOrder {
    return {
        id: '1',
        code: 'ORD-1',
        state: 'AddingItems',
        totalQuantity: 3,
        // 2 x 120000 + 1 x 60000 = 300000 with tax; ex-tax at 19% VAT.
        subTotal: 252101,
        subTotalWithTax: 300000,
        shipping: 42017,
        shippingWithTax: 50000,
        total: 294118,
        totalWithTax: 350000,
        currencyCode: 'DZD',
        couponCodes: [],
        discounts: [],
        lines: [
            {
                id: 'line-1',
                productVariant: {
                    id: 'v1',
                    name: 'ESP32',
                    sku: 'ESP32',
                    product: {id: 'p1', name: 'ESP32', slug: 'esp32', featuredAsset: null},
                },
                unitPriceWithTax: 120000,
                quantity: 2,
                linePriceWithTax: 240000,
            },
            {
                id: 'line-2',
                productVariant: {
                    id: 'v2',
                    name: 'Jumper wires',
                    sku: 'JW',
                    product: {id: 'p2', name: 'Jumper wires', slug: 'jw', featuredAsset: null},
                },
                unitPriceWithTax: 60000,
                quantity: 1,
                linePriceWithTax: 60000,
            },
        ],
    } as unknown as ActiveOrder;
}

export async function run(): Promise<void> {
    // --- adjust -----------------------------------------------------------
    const bumped = adjustLineQuantity(order(), 'line-1', 3);
    const line = bumped.lines.find(l => l.id === 'line-1');

    assert.equal(line?.quantity, 3);
    assert.equal(
        line?.linePriceWithTax,
        360000,
        'the line price follows the quantity; a stale line price is visible next to the total',
    );
    assert.equal(bumped.subTotalWithTax, 420000, 'subtotal is the sum of lines');
    assert.equal(bumped.totalQuantity, 4, 'the badge count follows too');
    assert.equal(
        bumped.totalWithTax,
        420000 + 50000,
        'shipping survives an optimistic line change',
    );

    // The original is untouched: rollback restores by reference, so a mutation
    // in place would make the snapshot useless.
    const original = order();
    adjustLineQuantity(original, 'line-1', 9);
    assert.equal(original.lines[0].quantity, 2, 'the input order is not mutated');

    // --- quantity zero removes, matching Vendure --------------------------
    const zeroed = adjustLineQuantity(order(), 'line-1', 0);
    assert.equal(zeroed.lines.length, 1);
    assert.equal(zeroed.totalQuantity, 1);
    assert.equal(zeroed.subTotalWithTax, 60000);

    // --- remove -----------------------------------------------------------
    const removed = removeLine(order(), 'line-2');
    assert.equal(removed.lines.length, 1);
    assert.equal(removed.subTotalWithTax, 240000);
    assert.equal(removed.totalWithTax, 290000);

    // Emptying the cart must not divide by zero or produce NaN.
    const empty = removeLine(removeLine(order(), 'line-1'), 'line-2');
    assert.equal(empty.lines.length, 0);
    assert.equal(empty.subTotalWithTax, 0);
    assert.equal(empty.totalQuantity, 0);
    assert.ok(Number.isFinite(empty.totalWithTax), 'an empty cart has finite totals');

    // --- add --------------------------------------------------------------
    const addedExisting = addToCartOptimistic(order(), 'v1', 1);
    assert.ok(addedExisting);
    assert.equal(
        addedExisting.lines.find(l => l.id === 'line-1')?.quantity,
        3,
        'adding a variant already in the cart is an exact quantity bump',
    );
    assert.equal(addedExisting.subTotalWithTax, 420000);

    const addedNew = addToCartOptimistic(order(), 'v-new', 2);
    assert.ok(addedNew);
    assert.equal(addedNew.totalQuantity, 5, 'a new variant moves the badge immediately');
    assert.equal(
        addedNew.lines.length,
        2,
        'but invents no placeholder line: a wrong price is worse than a late one',
    );
    assert.equal(addedNew.subTotalWithTax, 300000, 'and does not fabricate a subtotal');

    // A guest with no cart yet has nothing to update optimistically.
    assert.equal(addToCartOptimistic(null, 'v1', 1), null);

    // --- helpers ----------------------------------------------------------
    assert.equal(findLineByVariant(order(), 'v2')?.id, 'line-2');
    assert.equal(findLineByVariant(order(), 'nope'), undefined);
    assert.equal(cartCount(order()), 3);
    assert.equal(cartCount(null), 0, 'an empty cart badge reads zero, not NaN');
    assert.equal(cartCount(undefined), 0);

    // --- discounts survive recomputation ----------------------------------
    const discounted = recomputeTotals({
        ...order(),
        discounts: [{description: '10% off', amountWithTax: -30000}],
    } as ActiveOrder);
    assert.equal(
        discounted.totalWithTax,
        300000 + 50000 - 30000,
        'a promotion is preserved through an optimistic update',
    );
}
