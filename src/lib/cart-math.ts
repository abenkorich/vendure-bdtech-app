import type {ActiveOrder, ActiveOrderLine} from '@/lib/types';
import {saleAdjustmentSource} from '@/lib/order-discounts';

/**
 * Optimistic cart arithmetic, kept pure and free of React Native so it can be
 * unit-tested in Node.
 *
 * This is the part of the cart that is easy to get subtly wrong: a quantity
 * bumped without recomputing `linePriceWithTax` leaves a cart whose lines and
 * total disagree for the length of a round-trip, which readers notice
 * immediately because the two numbers sit next to each other on screen.
 *
 * Every value is **integer minor units**. Multiplication is exact; no
 * floating-point drift is possible as long as nothing here divides.
 *
 * Discounts. Sale prices come from the platform's product-discounts engine,
 * and a line's sale can depend on things this module cannot see: a per-order
 * cap, a "first N units" limit shared with every other order, a quantity
 * tier, and the coupon-versus-sale arbitration, which prices a copy of the
 * whole order on the server. Restating that engine here would be a second
 * copy that drifts from the first, so this module prices locally only what is
 * provably linear, and leaves the rest to the server:
 *
 * - A line with no discount and no tier it could cross costs unit × quantity.
 * - A sale line whose discount applies from one unit, with no cap and no unit
 *   limit, saves the same amount per unit, so its saving scales with the
 *   quantity exactly.
 * - Anything else — a capped or limited sale, a tier crossed, a coupon on the
 *   order, any other promotion — moves the quantity (and the undiscounted
 *   line price, which is always exact) at once, and marks the affected prices
 *   and the totals as pending. The screen dims them until the server answers
 *   a few hundred milliseconds later. A price that corrects itself is worse
 *   than one that is visibly on its way.
 *
 * Marks are client-only fields on the cached order; a server answer does not
 * carry them, so the refetch on settle clears them.
 */

export interface PricingMarks {
    /** Lines whose discounted price the server has yet to recompute. */
    pendingLineIds?: readonly string[];
    /** Discount rows and totals the server has yet to recompute. */
    totalsPending?: boolean;
}

/** The cart as cached: the server's order, plus what an optimistic update marked. */
export type CartOrder = ActiveOrder & PricingMarks;

type Sale = ActiveOrder['productDiscounts']['lines'][number];

function saleOf(order: CartOrder, lineId: string): Sale | undefined {
    return order.productDiscounts.lines.find(sale => sale.orderLineId === lineId);
}

/**
 * Pricing that couples lines: a coupon (it may start applying, or win or lose
 * against the sale) or any promotion other than the sale itself (order-level
 * shares, buy-X-get-Y, thresholds). The sale is the only discount priced here.
 */
function hasCoupledPricing(order: CartOrder, saleSource: string | null): boolean {
    return (
        order.couponCodes.length > 0 ||
        order.discounts.some(discount => discount.adjustmentSource !== saleSource)
    );
}

/** A quantity tier on the line's variant that `from` and `to` fall either side of. */
function crossesTier(line: ActiveOrderLine, from: number, to: number): boolean {
    return line.productVariant.quantityDiscounts.some(
        tier => from >= tier.minQuantity !== to >= tier.minQuantity,
    );
}

/** Untouched by any discount, now or at another quantity. */
function isPlain(order: CartOrder, line: ActiveOrderLine): boolean {
    return (
        line.discounts.length === 0 &&
        line.discountedLinePriceWithTax === line.linePriceWithTax &&
        !line.productVariant.discount &&
        line.productVariant.quantityDiscounts.length === 0 &&
        !saleOf(order, line.id)
    );
}

/** Lines whose price the server could change after a coupled or limited update. */
function nonPlainLineIds(order: CartOrder): string[] {
    return order.lines.filter(line => !isPlain(order, line)).map(line => line.id);
}

/** A sale that takes the same amount off every unit, at any quantity. */
function isLinearSale(line: ActiveOrderLine, sale: Sale, saleSource: string | null): boolean {
    const discount = line.productVariant.discount;
    return (
        saleSource !== null &&
        discount !== null &&
        // From one unit: a tier's sale would stop below its minimum.
        discount.productDiscountId === sale.productDiscountId &&
        discount.maxQuantityPerOrder == null &&
        discount.unitsRemaining == null &&
        sale.unitSavingWithTax > 0 &&
        sale.discountedQuantity === line.quantity &&
        sale.savingWithTax === sale.unitSavingWithTax * line.quantity &&
        line.discounts.length === 1 &&
        line.discounts[0]!.adjustmentSource === saleSource &&
        line.discountedLinePriceWithTax === line.linePriceWithTax - sale.savingWithTax
    );
}

function replaceLine(order: CartOrder, line: ActiveOrderLine): CartOrder {
    return {...order, lines: order.lines.map(candidate => (candidate.id === line.id ? line : candidate))};
}

function recount(order: CartOrder): CartOrder {
    return {...order, totalQuantity: order.lines.reduce((sum, line) => sum + line.quantity, 0)};
}

function markPending(order: CartOrder, lineIds: readonly string[]): CartOrder {
    const pending = new Set([...(order.pendingLineIds ?? []), ...lineIds]);
    return {...recount(order), pendingLineIds: [...pending], totalsPending: true};
}

/** Put new sale lines on the order, with the sale's order-level row to match. */
function withSales(order: CartOrder, sales: Sale[], saleSource: string): CartOrder {
    const savingWithTax = sales.reduce((sum, sale) => sum + sale.savingWithTax, 0);
    return {
        ...order,
        productDiscounts: {
            ...order.productDiscounts,
            lines: sales,
            savingWithTax,
            // No coupon is on an order priced locally, so nothing competes.
            potentialSavingWithTax: savingWithTax,
        },
        discounts:
            sales.length === 0
                ? order.discounts.filter(discount => discount.adjustmentSource !== saleSource)
                : order.discounts.map(discount =>
                      discount.adjustmentSource === saleSource
                          ? {...discount, amountWithTax: -savingWithTax}
                          : discount,
                  ),
    };
}

/**
 * Recompute order totals from lines, preserving shipping and surcharges.
 *
 * Sums the *discounted* line prices, which is what Vendure's
 * `subTotalWithTax` is when no order-level promotion is spread over the lines;
 * callers only reach here when none is.
 */
export function recomputeTotals<T extends CartOrder>(order: T): T {
    const surcharges = (order.surcharges ?? []).reduce((sum, surcharge) => sum + surcharge.priceWithTax, 0);
    const subTotalWithTax =
        order.lines.reduce((sum, line) => sum + line.discountedLinePriceWithTax, 0) + surcharges;
    const totalQuantity = order.lines.reduce((sum, line) => sum + line.quantity, 0);

    // Tax ratio is held constant: the exact split is the server's to decide,
    // and any local guess would be wrong for a mixed-rate cart.
    const taxRatio = order.subTotalWithTax > 0 ? order.subTotal / order.subTotalWithTax : 1;
    const subTotal = Math.round(subTotalWithTax * taxRatio);

    return {
        ...order,
        totalQuantity,
        subTotalWithTax,
        subTotal,
        totalWithTax: subTotalWithTax + order.shippingWithTax,
        total: subTotal + order.shipping,
    };
}

export function adjustLineQuantity(order: CartOrder, lineId: string, quantity: number): CartOrder {
    if (quantity <= 0) return removeLine(order, lineId);

    const line = order.lines.find(candidate => candidate.id === lineId);
    if (!line || line.quantity === quantity) return order;

    const regular = line.unitPriceWithTax * quantity;
    const saleSource = saleAdjustmentSource(order);
    const coupled = hasCoupledPricing(order, saleSource);
    const sale = saleOf(order, lineId);

    const plainChange =
        line.discounts.length === 0 &&
        line.discountedLinePriceWithTax === line.linePriceWithTax &&
        !line.productVariant.discount &&
        !sale &&
        !crossesTier(line, line.quantity, quantity);

    if (plainChange) {
        const next = replaceLine(order, {
            ...line,
            quantity,
            linePriceWithTax: regular,
            discountedLinePriceWithTax: regular,
        });
        return coupled ? markPending(next, nonPlainLineIds(next)) : recomputeTotals(next);
    }

    if (!coupled && sale && isLinearSale(line, sale, saleSource) && !crossesTier(line, line.quantity, quantity)) {
        const saving = sale.unitSavingWithTax * quantity;
        const next = replaceLine(order, {
            ...line,
            quantity,
            linePriceWithTax: regular,
            discountedLinePriceWithTax: regular - saving,
            discounts: line.discounts.map(discount =>
                discount.adjustmentSource === saleSource ? {...discount, amountWithTax: -saving} : discount,
            ),
        });
        const sales = order.productDiscounts.lines.map(candidate =>
            candidate.orderLineId === lineId
                ? {...candidate, discountedQuantity: quantity, savingWithTax: saving}
                : candidate,
        );
        return recomputeTotals(withSales(next, sales, saleSource as string));
    }

    // The undiscounted price is exact whatever the engine decides; the
    // discounted one is not ours to guess.
    const next = replaceLine(order, {...line, quantity, linePriceWithTax: regular});
    return markPending(next, [lineId, ...nonPlainLineIds(next)]);
}

export function removeLine(order: CartOrder, lineId: string): CartOrder {
    const line = order.lines.find(candidate => candidate.id === lineId);
    if (!line) return order;

    const saleSource = saleAdjustmentSource(order);
    const coupled = hasCoupledPricing(order, saleSource);
    const sale = saleOf(order, lineId);

    const rest: CartOrder = {
        ...order,
        lines: order.lines.filter(candidate => candidate.id !== lineId),
        ...(order.pendingLineIds
            ? {pendingLineIds: order.pendingLineIds.filter(id => id !== lineId)}
            : {}),
    };

    // A line no discount touched leaves nothing behind but its price.
    if (!coupled && line.discounts.length === 0 && !sale) return recomputeTotals(rest);

    // An unlimited per-unit sale leaves nothing behind either: no cap or unit
    // limit it shared with another line.
    if (!coupled && sale && isLinearSale(line, sale, saleSource)) {
        const sales = order.productDiscounts.lines.filter(candidate => candidate.orderLineId !== lineId);
        return recomputeTotals(withSales(rest, sales, saleSource as string));
    }

    return markPending(rest, nonPlainLineIds(rest));
}

/** Line already holding this variant, if any. Adding to it beats a new line. */
export function findLineByVariant(
    order: ActiveOrder,
    variantId: string,
): ActiveOrderLine | undefined {
    return order.lines.find(line => line.productVariant.id === variantId);
}

/**
 * Optimistic add.
 *
 * When the variant is already in the cart the quantity is exact. When it is
 * not, there is no line id and no unit price to hand yet, so the *only*
 * honest local update is the badge count: `totalQuantity`. Inventing a
 * placeholder line would put a wrong price on screen, and a price that
 * corrects itself a moment later is worse than one that appears a moment
 * later. The server reconciles on settle.
 */
export function addToCartOptimistic(
    order: CartOrder | null,
    variantId: string,
    quantity: number,
): CartOrder | null {
    if (!order) return null;

    const existing = findLineByVariant(order, variantId);
    if (existing) {
        return adjustLineQuantity(order, existing.id, existing.quantity + quantity);
    }
    return {...order, totalQuantity: order.totalQuantity + quantity};
}

/** Total item count for a tab badge; safe on a null (empty) cart. */
export function cartCount(order: ActiveOrder | null | undefined): number {
    return order?.totalQuantity ?? 0;
}
