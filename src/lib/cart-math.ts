import type {ActiveOrder, ActiveOrderLine} from '@/lib/types';

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
 */

/** Recompute order totals from lines, preserving shipping and discounts. */
export function recomputeTotals(order: ActiveOrder): ActiveOrder {
    const subTotalWithTax = order.lines.reduce((sum, line) => sum + line.linePriceWithTax, 0);
    const totalQuantity = order.lines.reduce((sum, line) => sum + line.quantity, 0);

    // Tax ratio is held constant: the exact split is the server's to decide,
    // and any local guess would be wrong for a mixed-rate cart.
    const taxRatio = order.subTotalWithTax > 0 ? order.subTotal / order.subTotalWithTax : 1;
    const discountTotal = order.discounts.reduce((sum, d) => sum + d.amountWithTax, 0);

    return {
        ...order,
        totalQuantity,
        subTotalWithTax,
        subTotal: Math.round(subTotalWithTax * taxRatio),
        totalWithTax: subTotalWithTax + order.shippingWithTax + discountTotal,
        total: Math.round(subTotalWithTax * taxRatio) + order.shipping + discountTotal,
    };
}

export function adjustLineQuantity(
    order: ActiveOrder,
    lineId: string,
    quantity: number,
): ActiveOrder {
    if (quantity <= 0) return removeLine(order, lineId);

    const lines = order.lines.map(line =>
        line.id === lineId
            ? {...line, quantity, linePriceWithTax: line.unitPriceWithTax * quantity}
            : line,
    );
    return recomputeTotals({...order, lines});
}

export function removeLine(order: ActiveOrder, lineId: string): ActiveOrder {
    return recomputeTotals({...order, lines: order.lines.filter(line => line.id !== lineId)});
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
    order: ActiveOrder | null,
    variantId: string,
    quantity: number,
): ActiveOrder | null {
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
