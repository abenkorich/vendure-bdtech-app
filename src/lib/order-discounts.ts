/**
 * Order discounts, read for display: which lines are on sale, and a totals
 * breakdown whose rows add up to the amount the customer pays.
 *
 * Written for the app (not copied from the web storefront). The pricing itself
 * is the server's: the platform's `product-discounts` plugin applies sale
 * prices through one managed promotion, and `Order.productDiscounts` reports
 * per-line names and savings. This module only arranges those answers, and is
 * kept free of React Native so the arithmetic is testable in Node.
 *
 * Every amount is integer minor units, tax included.
 *
 * Two Vendure facts shape the breakdown:
 *
 * - `subTotalWithTax` is already net of every line discount, so a "Subtotal"
 *   row followed by discount rows must start from the undiscounted line prices
 *   (`linePriceWithTax`), or the discounts are taken off twice.
 * - `Order.discounts` groups shipping discounts in with line discounts, while
 *   `shippingWithTax` is already net of them; so the shipping row shows the
 *   price before its discounts, and the discount rows carry them.
 */

export interface AdjustmentLike {
    adjustmentSource: string;
    type?: string;
    description: string;
    amountWithTax: number;
}

export interface OrderLineLike {
    id: string;
    quantity: number;
    linePriceWithTax: number;
    discountedLinePriceWithTax: number;
    discounts: readonly {adjustmentSource: string; amountWithTax: number}[];
}

/** `Order.productDiscounts.lines[]`. */
export interface LineSaleLike {
    orderLineId: string;
    productDiscountId: string;
    name: string;
    discountedQuantity: number;
    unitSavingWithTax: number;
    savingWithTax: number;
    percentOff: number;
}

/** `Order.productDiscounts`. Only live on an active order; see `totalsBreakdown`. */
export interface OrderProductDiscountsLike {
    lines: readonly LineSaleLike[];
    savingWithTax?: number;
    potentialSavingWithTax?: number;
    replacedByCoupon: boolean;
    suppressedCouponCodes: readonly string[];
}

export interface BreakdownOrderLike {
    lines: readonly OrderLineLike[];
    discounts: readonly AdjustmentLike[];
    surcharges?: readonly {description: string; priceWithTax: number}[] | null;
    shippingWithTax: number;
    shippingLines?: readonly {priceWithTax: number}[] | null;
    total: number;
    totalWithTax: number;
    productDiscounts?: OrderProductDiscountsLike | null;
}

export type BreakdownRowKind = 'sale' | 'promotion' | 'surcharge' | 'adjustment';

export interface BreakdownRow {
    key: string;
    kind: BreakdownRowKind;
    /** Discount name or promotion description; null when the API gave none. */
    label: string | null;
    /** Effect on the total: negative for a discount, positive for a surcharge. */
    delta: number;
}

export interface TotalsBreakdown {
    /** Undiscounted line prices, summed. */
    subtotal: number;
    rows: BreakdownRow[];
    /** Shipping before shipping discounts (those are rows). */
    shipping: number;
    hasShippingLines: boolean;
    /** `totalWithTax`, untouched: the number the customer pays. */
    total: number;
    /** Tax inside `total`, for an "includes tax" note. */
    taxIncluded: number;
}

/** The sale on one line of an active order, if it has one. */
export function lineSale(
    order: {productDiscounts?: OrderProductDiscountsLike | null},
    lineId: string,
): LineSaleLike | null {
    return order.productDiscounts?.lines.find(sale => sale.orderLineId === lineId) ?? null;
}

/**
 * Rounding allowance for one line, in minor units. In a channel whose prices
 * exclude tax, Vendure grosses a net adjustment up per unit and rounds, so a
 * line can differ from the engine's tax-inclusive saving by up to a unit per
 * item. In a tax-inclusive channel the two are equal.
 */
function lineTolerance(quantity: number): number {
    return Math.max(1, quantity);
}

/**
 * The `adjustmentSource` of the managed sale promotion on this order.
 *
 * The Shop API does not expose the promotion's id, but its adjustments are
 * recognisable: it adjusts every sale line by exactly that line's saving, and
 * nothing else. A source must match on *every* sale line, and its order-level
 * total must match the sum of the savings, before it is treated as the sale.
 * When nothing qualifies the caller keeps Vendure's own rows, which still add
 * up; they are just labelled with the promotion's name instead of each
 * discount's.
 */
export function saleAdjustmentSource(order: BreakdownOrderLike): string | null {
    const sales = order.productDiscounts?.lines ?? [];
    if (sales.length === 0) return null;

    const votes = new Map<string, number>();
    let tolerance = 0;
    for (const sale of sales) {
        const line = order.lines.find(candidate => candidate.id === sale.orderLineId);
        if (!line) return null;
        tolerance += lineTolerance(line.quantity);
        const matched = new Set<string>();
        for (const adjustment of line.discounts) {
            if (Math.abs(adjustment.amountWithTax + sale.savingWithTax) <= lineTolerance(line.quantity)) {
                matched.add(adjustment.adjustmentSource);
            }
        }
        for (const source of matched) votes.set(source, (votes.get(source) ?? 0) + 1);
    }

    const candidates = [...votes.entries()].filter(([, count]) => count === sales.length);
    if (candidates.length === 0) return null;

    const saving = sales.reduce((sum, sale) => sum + sale.savingWithTax, 0);
    const confirmed = candidates.filter(([source]) => {
        const entry = order.discounts.find(discount => discount.adjustmentSource === source);
        return entry !== undefined && Math.abs(entry.amountWithTax + saving) <= tolerance;
    });
    return confirmed[0]?.[0] ?? null;
}

export interface BreakdownOptions {
    /**
     * The order was changed optimistically and its discounts and totals are
     * stale until the server answers. The rows are then shown as they are,
     * without reconciling them against a total they no longer belong to.
     */
    pending?: boolean;
}

/**
 * Subtotal before discounts, one row per discount, shipping, total.
 *
 * The rows are reconciled against `totalWithTax`: Vendure rounds line prices
 * per unit, so the sum of its adjustments can miss the total by a few minor
 * units. That remainder is folded into the largest discount row, so the column
 * adds up exactly, which is the property the customer checks. A remainder too
 * large to be rounding is not hidden: it becomes its own row.
 *
 * Sale rows come from `Order.productDiscounts`, which is computed against the
 * discounts live *now*. That is right for an active order and wrong for a
 * placed one (a sale that has since ended would vanish from it), so order
 * history documents do not select it and get Vendure's stored rows instead.
 */
export function totalsBreakdown(
    order: BreakdownOrderLike,
    options: BreakdownOptions = {},
): TotalsBreakdown {
    const subtotal = order.lines.reduce((sum, line) => sum + line.linePriceWithTax, 0);
    const shippingLines = order.shippingLines ?? [];
    const hasShippingLines = shippingLines.length > 0;
    const shipping = hasShippingLines
        ? shippingLines.reduce((sum, line) => sum + line.priceWithTax, 0)
        : order.shippingWithTax;

    const rows: BreakdownRow[] = [];
    const source = saleAdjustmentSource(order);

    if (source !== null) {
        const byDiscount = new Map<string, BreakdownRow>();
        for (const sale of order.productDiscounts?.lines ?? []) {
            const row = byDiscount.get(sale.productDiscountId);
            if (row) {
                row.delta -= sale.savingWithTax;
            } else {
                const created: BreakdownRow = {
                    key: `sale:${sale.productDiscountId}`,
                    kind: 'sale',
                    label: sale.name || null,
                    delta: -sale.savingWithTax,
                };
                byDiscount.set(sale.productDiscountId, created);
                rows.push(created);
            }
        }
    }

    for (const discount of order.discounts) {
        if (discount.adjustmentSource === source || discount.amountWithTax === 0) continue;
        rows.push({
            key: `promotion:${discount.adjustmentSource}`,
            kind: 'promotion',
            label: discount.description || null,
            delta: discount.amountWithTax,
        });
    }

    (order.surcharges ?? []).forEach((surcharge, index) => {
        if (surcharge.priceWithTax === 0) return;
        rows.push({
            key: `surcharge:${index}`,
            kind: 'surcharge',
            label: surcharge.description || null,
            delta: surcharge.priceWithTax,
        });
    });

    if (!options.pending) {
        const expected = subtotal + rows.reduce((sum, row) => sum + row.delta, 0) + shipping;
        const residue = order.totalWithTax - expected;
        if (residue !== 0) {
            const tolerance =
                order.lines.reduce((sum, line) => sum + lineTolerance(line.quantity), 0) +
                shippingLines.length +
                1;
            const largest = rows
                .filter(row => row.kind === 'sale' || row.kind === 'promotion')
                .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
            if (largest && Math.abs(residue) <= tolerance) {
                largest.delta += residue;
            } else {
                rows.push({key: 'adjustment', kind: 'adjustment', label: null, delta: residue});
            }
        }
    }

    return {
        subtotal,
        rows,
        shipping,
        hasShippingLines,
        total: order.totalWithTax,
        taxIncluded: Math.max(0, order.totalWithTax - order.total),
    };
}

export type CouponArbitration =
    /** A coupon that does not combine with sales saves more; sale prices are off. */
    | {kind: 'couponWins'; potentialSavingWithTax: number}
    /** The sale saves more; these coupon codes stay on the order but give nothing. */
    | {kind: 'saleWins'; couponCodes: readonly string[]};

/** What to tell the shopper about a coupon and the sale prices, if anything. */
export function couponArbitration(
    productDiscounts: OrderProductDiscountsLike | null | undefined,
): CouponArbitration | null {
    if (!productDiscounts) return null;
    if (productDiscounts.replacedByCoupon) {
        return {kind: 'couponWins', potentialSavingWithTax: productDiscounts.potentialSavingWithTax ?? 0};
    }
    if (productDiscounts.suppressedCouponCodes.length > 0) {
        return {kind: 'saleWins', couponCodes: productDiscounts.suppressedCouponCodes};
    }
    return null;
}
