import assert from 'node:assert/strict';
import type {ActiveOrder} from '@/lib/types';
import {
    adjustLineQuantity,
    removeLine,
    addToCartOptimistic,
    findLineByVariant,
    recomputeTotals,
    cartCount,
    type CartOrder,
} from '@/lib/cart-math';
import {totalsBreakdown} from '@/lib/order-discounts';

/**
 * Optimistic cart arithmetic.
 *
 * These are the numbers the customer is about to pay, computed locally so a
 * tap registers on the same frame. Every value is integer minor units (DZD
 * centimes), so the assertions below are exact by construction: any rounding
 * that crept in would show as a failure here rather than as a total that is
 * off by one centime on a real cart.
 *
 * With product discounts the rule is: price locally only what is provably
 * linear, and mark everything else pending for the server. So the tests check
 * both halves — that exact cases are exact (and still add up in the totals
 * breakdown), and that the rest is left alone rather than guessed.
 */

type Line = ActiveOrder['lines'][number];
type Sale = ActiveOrder['productDiscounts']['lines'][number];

interface LineSpec {
    id: string;
    variantId: string;
    unit: number;
    quantity: number;
    /** A sale from one unit: `percent` of the unit price off every unit. */
    sale?: {
        productDiscountId: string;
        name: string;
        percent: number;
        source: string;
        maxQuantityPerOrder?: number | null;
        unitsRemaining?: number | null;
    };
    /** Minimum quantities of the variant's quantity tiers. */
    tiers?: number[];
}

function makeLine(spec: LineSpec): {line: Line; sale: Sale | null} {
    const regular = spec.unit * spec.quantity;
    const unitSaving = spec.sale ? (spec.unit * spec.sale.percent) / 100 : 0;
    const saving = unitSaving * spec.quantity;
    const line = {
        id: spec.id,
        discountedLinePriceWithTax: regular - saving,
        discounts: spec.sale ? [{adjustmentSource: spec.sale.source, amountWithTax: -saving}] : [],
        productVariant: {
            id: spec.variantId,
            name: spec.variantId,
            sku: spec.variantId.toUpperCase(),
            discount: spec.sale
                ? {
                      productDiscountId: spec.sale.productDiscountId,
                      maxQuantityPerOrder: spec.sale.maxQuantityPerOrder ?? null,
                      unitsRemaining: spec.sale.unitsRemaining ?? null,
                  }
                : null,
            quantityDiscounts: (spec.tiers ?? []).map(minQuantity => ({minQuantity})),
            product: {id: `p-${spec.variantId}`, name: spec.variantId, slug: spec.variantId, featuredAsset: null},
        },
        unitPriceWithTax: spec.unit,
        quantity: spec.quantity,
        linePriceWithTax: regular,
    } as unknown as Line;
    const sale = spec.sale
        ? ({
              orderLineId: spec.id,
              productDiscountId: spec.sale.productDiscountId,
              name: spec.sale.name,
              discountedQuantity: spec.quantity,
              unitSavingWithTax: unitSaving,
              savingWithTax: saving,
              percentOff: spec.sale.percent,
          } as Sale)
        : null;
    return {line, sale};
}

/** A server-consistent order: 19% VAT, 500 DZD shipping, one sale promotion. */
function makeOrder(specs: LineSpec[], extra: Partial<CartOrder> = {}): CartOrder {
    const built = specs.map(makeLine);
    const lines = built.map(entry => entry.line);
    const sales = built.flatMap(entry => (entry.sale ? [entry.sale] : []));
    const saving = sales.reduce((sum, sale) => sum + sale.savingWithTax, 0);
    const sources = [...new Set(specs.flatMap(spec => (spec.sale ? [spec.sale.source] : [])))];
    const subTotalWithTax = lines.reduce((sum, line) => sum + line.discountedLinePriceWithTax, 0);
    const shippingWithTax = 50000;
    const subTotal = Math.round(subTotalWithTax / 1.19);
    const shipping = Math.round(shippingWithTax / 1.19);

    return {
        id: '1',
        code: 'ORD-1',
        state: 'AddingItems',
        totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
        subTotal,
        subTotalWithTax,
        shipping,
        shippingWithTax,
        total: subTotal + shipping,
        totalWithTax: subTotalWithTax + shippingWithTax,
        currencyCode: 'DZD',
        couponCodes: [],
        discounts: sources.map(source => ({
            adjustmentSource: source,
            type: 'PROMOTION',
            description: 'Sale',
            amountWithTax: -saving,
        })),
        surcharges: [],
        shippingLines: [{priceWithTax: shippingWithTax}],
        productDiscounts: {
            lines: sales,
            savingWithTax: saving,
            potentialSavingWithTax: saving,
            replacedByCoupon: false,
            suppressedCouponCodes: [],
        },
        lines,
        ...extra,
    } as unknown as CartOrder;
}

/** What the cart renders must add up to the total it shows, with nothing unexplained. */
function assertAddsUp(order: CartOrder, message: string): void {
    const breakdown = totalsBreakdown(order);
    const rows = breakdown.rows.reduce((sum, row) => sum + row.delta, 0);
    assert.equal(breakdown.subtotal + rows + breakdown.shipping, breakdown.total, message);
    assert.ok(
        !breakdown.rows.some(row => row.kind === 'adjustment'),
        `${message}: no unexplained adjustment row`,
    );
}

const SALE = {productDiscountId: 'd1', name: 'Summer sale', percent: 20, source: 'PROMOTION:9'};

function plainOrder(): CartOrder {
    // 2 x 120000 + 1 x 60000 = 300000 with tax.
    return makeOrder([
        {id: 'line-1', variantId: 'v1', unit: 120000, quantity: 2},
        {id: 'line-2', variantId: 'v2', unit: 60000, quantity: 1},
    ]);
}

function saleOrder(sale: LineSpec['sale'] = SALE): CartOrder {
    return makeOrder([
        {id: 'line-s', variantId: 'vs', unit: 100000, quantity: 2, sale},
        {id: 'line-2', variantId: 'v2', unit: 60000, quantity: 1},
    ]);
}

export async function run(): Promise<void> {
    // --- adjust -----------------------------------------------------------
    const bumped = adjustLineQuantity(plainOrder(), 'line-1', 3);
    const line = bumped.lines.find(l => l.id === 'line-1');

    assert.equal(line?.quantity, 3);
    assert.equal(
        line?.linePriceWithTax,
        360000,
        'the line price follows the quantity; a stale line price is visible next to the total',
    );
    assert.equal(line?.discountedLinePriceWithTax, 360000, 'an undiscounted line is its own discounted price');
    assert.equal(bumped.subTotalWithTax, 420000, 'subtotal is the sum of lines');
    assert.equal(bumped.totalQuantity, 4, 'the badge count follows too');
    assert.equal(
        bumped.totalWithTax,
        420000 + 50000,
        'shipping survives an optimistic line change',
    );
    assert.equal(bumped.totalsPending, undefined, 'nothing on a plain cart is left for the server');
    assertAddsUp(bumped, 'a plain adjust adds up');

    // The original is untouched: rollback restores by reference, so a mutation
    // in place would make the snapshot useless.
    const original = plainOrder();
    adjustLineQuantity(original, 'line-1', 9);
    assert.equal(original.lines[0].quantity, 2, 'the input order is not mutated');

    // --- quantity zero removes, matching Vendure --------------------------
    const zeroed = adjustLineQuantity(plainOrder(), 'line-1', 0);
    assert.equal(zeroed.lines.length, 1);
    assert.equal(zeroed.totalQuantity, 1);
    assert.equal(zeroed.subTotalWithTax, 60000);

    // --- remove -----------------------------------------------------------
    const removed = removeLine(plainOrder(), 'line-2');
    assert.equal(removed.lines.length, 1);
    assert.equal(removed.subTotalWithTax, 240000);
    assert.equal(removed.totalWithTax, 290000);

    // Emptying the cart must not divide by zero or produce NaN.
    const empty = removeLine(removeLine(plainOrder(), 'line-1'), 'line-2');
    assert.equal(empty.lines.length, 0);
    assert.equal(empty.subTotalWithTax, 0);
    assert.equal(empty.totalQuantity, 0);
    assert.ok(Number.isFinite(empty.totalWithTax), 'an empty cart has finite totals');

    // --- add --------------------------------------------------------------
    const addedExisting = addToCartOptimistic(plainOrder(), 'v1', 1);
    assert.ok(addedExisting);
    assert.equal(
        addedExisting.lines.find(l => l.id === 'line-1')?.quantity,
        3,
        'adding a variant already in the cart is an exact quantity bump',
    );
    assert.equal(addedExisting.subTotalWithTax, 420000);

    const addedNew = addToCartOptimistic(plainOrder(), 'v-new', 2);
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
    assert.equal(findLineByVariant(plainOrder(), 'v2')?.id, 'line-2');
    assert.equal(findLineByVariant(plainOrder(), 'nope'), undefined);
    assert.equal(cartCount(plainOrder()), 3);
    assert.equal(cartCount(null), 0, 'an empty cart badge reads zero, not NaN');
    assert.equal(cartCount(undefined), 0);

    // --- surcharges survive recomputation ---------------------------------
    const withFee = recomputeTotals({
        ...plainOrder(),
        surcharges: [{description: 'Cash on delivery', priceWithTax: 2000}],
    } as CartOrder);
    assert.equal(withFee.subTotalWithTax, 302000, 'a surcharge is part of the subtotal, as in Vendure');
    assert.equal(withFee.totalWithTax, 302000 + 50000);

    // --- a per-unit sale scales exactly -----------------------------------
    const scaled = adjustLineQuantity(saleOrder(), 'line-s', 3);
    const scaledLine = scaled.lines.find(l => l.id === 'line-s')!;
    assert.equal(scaledLine.linePriceWithTax, 300000);
    assert.equal(scaledLine.discountedLinePriceWithTax, 240000, 'three units at the sale price');
    assert.equal(scaled.productDiscounts.lines[0]!.savingWithTax, 60000);
    assert.equal(scaled.productDiscounts.lines[0]!.discountedQuantity, 3);
    assert.equal(scaled.discounts[0]!.amountWithTax, -60000, "the sale's order-level row follows");
    assert.equal(scaled.subTotalWithTax, 300000);
    assert.equal(scaled.totalWithTax, 350000);
    assert.equal(scaled.totalsPending, undefined, 'an unlimited per-unit sale is priced locally');
    assertAddsUp(scaled, 'a sale scaled up adds up');

    const shrunk = adjustLineQuantity(saleOrder(), 'line-s', 1);
    assert.equal(shrunk.lines.find(l => l.id === 'line-s')!.discountedLinePriceWithTax, 80000);
    assert.equal(shrunk.subTotalWithTax, 140000);
    assertAddsUp(shrunk, 'a sale scaled down adds up');

    const saleRemoved = removeLine(saleOrder(), 'line-s');
    assert.equal(saleRemoved.productDiscounts.lines.length, 0);
    assert.equal(saleRemoved.discounts.length, 0, 'the sale row goes with its last line');
    assert.equal(saleRemoved.subTotalWithTax, 60000);
    assert.equal(saleRemoved.totalsPending, undefined);
    assertAddsUp(saleRemoved, 'removing a sale line adds up');

    const besideSale = adjustLineQuantity(saleOrder(), 'line-2', 2);
    assert.equal(besideSale.subTotalWithTax, 160000 + 120000, 'a plain line beside a sale is still exact');
    assert.equal(besideSale.totalsPending, undefined);
    assertAddsUp(besideSale, 'a plain line beside a sale adds up');

    // --- a capped sale is the server's to price ---------------------------
    const capped = () => saleOrder({...SALE, maxQuantityPerOrder: 2});
    const cappedUp = adjustLineQuantity(capped(), 'line-s', 3);
    const cappedLine = cappedUp.lines.find(l => l.id === 'line-s')!;
    assert.equal(cappedLine.quantity, 3, 'the quantity still moves on the same frame');
    assert.equal(cappedLine.linePriceWithTax, 300000, 'the undiscounted price is exact whatever the cap');
    assert.equal(
        cappedLine.discountedLinePriceWithTax,
        160000,
        'the discounted price is left for the server rather than guessed',
    );
    assert.deepEqual(cappedUp.pendingLineIds, ['line-s']);
    assert.equal(cappedUp.totalsPending, true);
    assert.equal(cappedUp.totalQuantity, 4, 'the badge still moves');
    assert.equal(cappedUp.totalWithTax, capped().totalWithTax, 'totals stay the last server answer');

    const afterCapped = adjustLineQuantity(cappedUp, 'line-2', 2);
    assert.equal(afterCapped.totalsPending, true, 'a later exact change does not clear the marks');
    assert.deepEqual(afterCapped.pendingLineIds, ['line-s']);

    const cappedRemoved = removeLine(capped(), 'line-s');
    assert.equal(cappedRemoved.lines.length, 1);
    assert.equal(cappedRemoved.totalsPending, true, 'a capped sale may have shared its cap');

    const limited = saleOrder({...SALE, unitsRemaining: 40});
    assert.equal(
        adjustLineQuantity(limited, 'line-s', 3).totalsPending,
        true,
        'a "first N units" sale is the server\'s: the units are counted across orders',
    );

    // --- quantity tiers ---------------------------------------------------
    const tiered = () => makeOrder([{id: 'line-t', variantId: 'vt', unit: 10000, quantity: 2, tiers: [3]}]);
    const belowTier = adjustLineQuantity(tiered(), 'line-t', 1);
    assert.equal(belowTier.totalsPending, undefined, 'a tier out of reach either side changes nothing');
    assert.equal(belowTier.subTotalWithTax, 10000);
    const intoTier = adjustLineQuantity(tiered(), 'line-t', 3);
    assert.equal(intoTier.totalsPending, true, 'reaching a tier is priced by the server');
    assert.deepEqual(intoTier.pendingLineIds, ['line-t']);

    // --- a coupon couples the whole order ---------------------------------
    const couponed = makeOrder(
        [
            {id: 'line-1', variantId: 'v1', unit: 120000, quantity: 2},
            {id: 'line-2', variantId: 'v2', unit: 60000, quantity: 1},
        ],
        {
            couponCodes: ['WELCOME10'],
            discounts: [
                {
                    adjustmentSource: 'PROMOTION:3',
                    type: 'DISTRIBUTED_ORDER_PROMOTION',
                    description: 'WELCOME10',
                    amountWithTax: -30000,
                },
            ],
        } as Partial<CartOrder>,
    );
    const couponAdjusted = adjustLineQuantity(couponed, 'line-1', 3);
    assert.equal(
        couponAdjusted.lines.find(l => l.id === 'line-1')?.linePriceWithTax,
        360000,
        'the line itself is still exact',
    );
    assert.equal(
        couponAdjusted.totalsPending,
        true,
        'a coupon can start, stop, or lose to a sale: the totals are the server\'s',
    );
    assert.deepEqual(couponAdjusted.pendingLineIds, [], 'plain lines are not dimmed');
    assert.equal(couponAdjusted.totalWithTax, couponed.totalWithTax);

    // --- a sale the adjustments do not confirm is not priced locally -----
    const unconfirmed = saleOrder();
    const mismatched = {
        ...unconfirmed,
        discounts: [{...unconfirmed.discounts[0]!, amountWithTax: -39000}],
    } as CartOrder;
    assert.equal(adjustLineQuantity(mismatched, 'line-s', 3).totalsPending, true);
}
