import assert from 'node:assert/strict';
import {
    couponArbitration,
    lineSale,
    saleAdjustmentSource,
    totalsBreakdown,
    type BreakdownOrderLike,
    type LineSaleLike,
    type TotalsBreakdown,
} from '@/lib/order-discounts';

/**
 * The totals breakdown under the cart, checkout and order detail.
 *
 * The property the customer checks is that the column adds up: subtotal,
 * minus each discount, plus shipping, equals the total. Vendure's figures do
 * not arrange themselves that way (its subtotal is already discounted, and its
 * discount list mixes shipping discounts in with line discounts), which is
 * what these cases pin down. Amounts are integer minor units, with tax.
 */

function line(
    id: string,
    unit: number,
    quantity: number,
    discounts: {adjustmentSource: string; amountWithTax: number}[] = [],
) {
    const regular = unit * quantity;
    return {
        id,
        quantity,
        linePriceWithTax: regular,
        discountedLinePriceWithTax: regular + discounts.reduce((sum, d) => sum + d.amountWithTax, 0),
        discounts,
    };
}

function sale(
    orderLineId: string,
    productDiscountId: string,
    name: string,
    discountedQuantity: number,
    unitSavingWithTax: number,
    percentOff: number,
): LineSaleLike {
    return {
        orderLineId,
        productDiscountId,
        name,
        discountedQuantity,
        unitSavingWithTax,
        savingWithTax: unitSavingWithTax * discountedQuantity,
        percentOff,
    };
}

function rows(breakdown: TotalsBreakdown) {
    return breakdown.rows.map(row => [row.kind, row.label, row.delta]);
}

function addsUp(breakdown: TotalsBreakdown): boolean {
    return (
        breakdown.subtotal + breakdown.rows.reduce((sum, row) => sum + row.delta, 0) + breakdown.shipping ===
        breakdown.total
    );
}

export async function run(): Promise<void> {
    // --- no discounts -------------------------------------------------------
    const plain: BreakdownOrderLike = {
        lines: [line('a', 120000, 2), line('b', 60000, 1)],
        discounts: [],
        surcharges: [],
        shippingWithTax: 50000,
        shippingLines: [{priceWithTax: 50000}],
        total: 294118,
        totalWithTax: 350000,
    };
    const plainBreakdown = totalsBreakdown(plain);
    assert.equal(plainBreakdown.subtotal, 300000);
    assert.deepEqual(plainBreakdown.rows, []);
    assert.equal(plainBreakdown.shipping, 50000);
    assert.equal(plainBreakdown.hasShippingLines, true);
    assert.equal(plainBreakdown.total, 350000, 'the total is never recomputed, only explained');
    assert.equal(plainBreakdown.taxIncluded, 55882);
    assert.ok(addsUp(plainBreakdown));

    const noShippingLines = totalsBreakdown({...plain, shippingLines: undefined});
    assert.equal(noShippingLines.hasShippingLines, false);
    assert.equal(noShippingLines.shipping, 50000, 'without shipping lines the order figure stands in');

    // --- sale rows, one per discount, instead of the promotion's own row ----
    const onSale: BreakdownOrderLike = {
        lines: [
            line('a', 100000, 2, [{adjustmentSource: 'PROMOTION:9', amountWithTax: -40000}]),
            line('b', 50000, 1, [{adjustmentSource: 'PROMOTION:9', amountWithTax: -5000}]),
            line('c', 30000, 3, [{adjustmentSource: 'PROMOTION:9', amountWithTax: -9000}]),
        ],
        discounts: [
            {adjustmentSource: 'PROMOTION:9', type: 'PROMOTION', description: 'Sale', amountWithTax: -54000},
        ],
        shippingWithTax: 0,
        shippingLines: [],
        total: 240336,
        totalWithTax: 286000,
        productDiscounts: {
            lines: [
                sale('a', 'd1', 'Summer sale', 2, 20000, 20),
                sale('b', 'd1', 'Summer sale', 1, 5000, 10),
                sale('c', 'd2', 'Clearance', 3, 3000, 10),
            ],
            replacedByCoupon: false,
            suppressedCouponCodes: [],
        },
    };
    assert.equal(saleAdjustmentSource(onSale), 'PROMOTION:9');
    const saleBreakdown = totalsBreakdown(onSale);
    assert.deepEqual(
        rows(saleBreakdown),
        [
            ['sale', 'Summer sale', -45000],
            ['sale', 'Clearance', -9000],
        ],
        'each discount by its own name, and the managed "Sale" row is not counted twice',
    );
    assert.equal(saleBreakdown.subtotal, 340000, 'the subtotal is before discounts');
    assert.ok(addsUp(saleBreakdown));

    // --- a stacking coupon and free shipping beside the sale ----------------
    const stacked: BreakdownOrderLike = {
        lines: [
            line('a', 100000, 1, [
                {adjustmentSource: 'PROMOTION:9', amountWithTax: -20000},
                {adjustmentSource: 'PROMOTION:4', amountWithTax: -8000},
            ]),
        ],
        discounts: [
            {adjustmentSource: 'PROMOTION:9', type: 'PROMOTION', description: 'Sale', amountWithTax: -20000},
            {adjustmentSource: 'PROMOTION:4', type: 'PROMOTION', description: 'WELCOME10', amountWithTax: -8000},
            {adjustmentSource: 'PROMOTION:5', type: 'PROMOTION', description: 'Free shipping', amountWithTax: -50000},
        ],
        shippingWithTax: 0,
        shippingLines: [{priceWithTax: 50000}],
        total: 60504,
        totalWithTax: 72000,
        productDiscounts: {
            lines: [sale('a', 'd1', 'Summer sale', 1, 20000, 20)],
            replacedByCoupon: false,
            suppressedCouponCodes: [],
        },
    };
    const stackedBreakdown = totalsBreakdown(stacked);
    assert.deepEqual(rows(stackedBreakdown), [
        ['sale', 'Summer sale', -20000],
        ['promotion', 'WELCOME10', -8000],
        ['promotion', 'Free shipping', -50000],
    ]);
    assert.equal(
        stackedBreakdown.shipping,
        50000,
        'shipping before its discount, which is a row: shippingWithTax is already net of it',
    );
    assert.ok(addsUp(stackedBreakdown));

    // --- a placed order: Vendure's stored rows, as they are ----------------
    const placed = totalsBreakdown({...stacked, productDiscounts: undefined});
    assert.deepEqual(rows(placed), [
        ['promotion', 'Sale', -20000],
        ['promotion', 'WELCOME10', -8000],
        ['promotion', 'Free shipping', -50000],
    ]);
    assert.ok(addsUp(placed));

    // --- a sale the order-level row does not confirm keeps Vendure's rows ---
    const unconfirmed = totalsBreakdown({
        ...onSale,
        discounts: [
            {adjustmentSource: 'PROMOTION:9', type: 'PROMOTION', description: 'Sale', amountWithTax: -50000},
        ],
        totalWithTax: 290000,
    });
    assert.deepEqual(rows(unconfirmed), [['promotion', 'Sale', -50000]]);
    assert.ok(addsUp(unconfirmed));

    // --- two adjustments of the same amount on one line still add up -------
    const twin = totalsBreakdown({
        lines: [
            line('a', 50000, 1, [
                {adjustmentSource: 'PROMOTION:9', amountWithTax: -5000},
                {adjustmentSource: 'PROMOTION:4', amountWithTax: -5000},
            ]),
        ],
        discounts: [
            {adjustmentSource: 'PROMOTION:9', type: 'PROMOTION', description: 'Sale', amountWithTax: -5000},
            {adjustmentSource: 'PROMOTION:4', type: 'PROMOTION', description: 'HALF', amountWithTax: -5000},
        ],
        shippingWithTax: 0,
        shippingLines: [],
        total: 33613,
        totalWithTax: 40000,
        productDiscounts: {
            lines: [sale('a', 'd1', 'Flash sale', 1, 5000, 10)],
            replacedByCoupon: false,
            suppressedCouponCodes: [],
        },
    });
    assert.equal(twin.rows.length, 2);
    assert.ok(addsUp(twin));

    // --- Vendure's per-unit rounding is folded into the largest row --------
    const rounded = totalsBreakdown({
        lines: [line('a', 10000, 3, [{adjustmentSource: 'PROMOTION:3', amountWithTax: -1000}])],
        discounts: [
            {
                adjustmentSource: 'PROMOTION:3',
                type: 'DISTRIBUTED_ORDER_PROMOTION',
                description: '10 DZD off',
                amountWithTax: -1000,
            },
        ],
        shippingWithTax: 0,
        shippingLines: [],
        // 9666.67 per unit, rounded per unit: 9667 x 3.
        total: 24371,
        totalWithTax: 29001,
    });
    assert.deepEqual(rows(rounded), [['promotion', '10 DZD off', -999]]);
    assert.ok(addsUp(rounded));

    // --- a gap too large for rounding is shown, not hidden -----------------
    const gap: BreakdownOrderLike = {
        lines: [line('a', 10000, 1)],
        discounts: [],
        shippingWithTax: 0,
        shippingLines: [],
        total: 12605,
        totalWithTax: 15000,
    };
    assert.deepEqual(rows(totalsBreakdown(gap)), [['adjustment', null, 5000]]);
    assert.deepEqual(
        totalsBreakdown(gap, {pending: true}).rows,
        [],
        'a pending order is not reconciled against a total it no longer belongs to',
    );

    // --- surcharges are rows too --------------------------------------------
    const surcharged = totalsBreakdown({
        lines: [line('a', 10000, 1)],
        discounts: [],
        surcharges: [{description: 'Cash on delivery', priceWithTax: 2000}],
        shippingWithTax: 0,
        shippingLines: [],
        total: 10084,
        totalWithTax: 12000,
    });
    assert.deepEqual(rows(surcharged), [['surcharge', 'Cash on delivery', 2000]]);
    assert.ok(addsUp(surcharged));

    // --- coupon arbitration ------------------------------------------------
    assert.equal(couponArbitration(null), null);
    assert.deepEqual(
        couponArbitration({
            lines: [],
            replacedByCoupon: true,
            potentialSavingWithTax: 12000,
            suppressedCouponCodes: [],
        }),
        {kind: 'couponWins', potentialSavingWithTax: 12000},
    );
    assert.deepEqual(
        couponArbitration({
            lines: [sale('a', 'd1', 'Summer sale', 1, 20000, 20)],
            replacedByCoupon: false,
            suppressedCouponCodes: ['WELCOME10'],
        }),
        {kind: 'saleWins', couponCodes: ['WELCOME10']},
    );
    assert.equal(
        couponArbitration({lines: [], replacedByCoupon: false, suppressedCouponCodes: []}),
        null,
    );

    // --- line lookup ---------------------------------------------------------
    assert.equal(lineSale(onSale, 'b')?.name, 'Summer sale');
    assert.equal(lineSale(onSale, 'missing'), null);
    assert.equal(lineSale({productDiscounts: null}, 'a'), null);
}
