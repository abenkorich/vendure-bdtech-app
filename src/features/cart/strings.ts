/**
 * Cart + checkout copy, keyed by the **real** message paths in
 * `messages/en.json`.
 *
 * Same interim shape as `src/features/catalogue-strings.ts`: the i18n
 * `useTranslations` hook lands in phase 2, and every literal below is the
 * English value that already exists in all three catalogs, so the swap to
 * `t('Cart.title')` is mechanical. Nothing here is invented — a string with no
 * key was added to `messages/{en,fr,ar}.json` first.
 */
export const CART_STRINGS = {
    /** Cart.* */
    title: 'Shopping Cart',
    empty: 'Your Cart is Empty',
    emptyMessage: 'Add some items to your cart to get started',
    continueShopping: 'Continue Shopping',
    each: 'each',
    orderSummary: 'Order Summary',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    calculatedAtCheckout: 'Calculated at checkout',
    total: 'Total',
    proceedToCheckout: 'Proceed to Checkout',
    promotionCode: 'Promotion Code',
    remove: 'Remove',
    enterCode: 'Enter code',
    apply: 'Apply',
    /** Cart.sku — `{sku}` */
    skuTemplate: 'SKU: {sku}',
    /** Cart.itemCount — `{count, plural, ...}` */
    itemCountOne: '1 item',
    itemCountOther: '{count} items',
    /** Cart.removedItem / Cart.undo — added for the mobile undo affordance. */
    removedItem: 'Item removed',
    undo: 'Undo',
    /** Cart.discount */
    discount: 'Discount',
    /** Cart.tax */
    tax: 'Tax',

    /** Product.outOfStock / Product.lowStock */
    outOfStock: 'Out of Stock',

    /** Errors.* */
    serverUnreachableTitle: 'Server unreachable',
    serverUnreachableBody:
        'Unable to reach the server. Please check your connection and ensure the backend is running.',
    tryAgain: 'Try again',
    somethingWentWrong: 'Something went wrong',
} as const;

/** `Cart.itemCount` without the ICU formatter, which lands with the i18n hook. */
export function itemCountLabel(count: number): string {
    return count === 1
        ? CART_STRINGS.itemCountOne
        : CART_STRINGS.itemCountOther.replace('{count}', String(count));
}

export function skuLabel(sku: string): string {
    return CART_STRINGS.skuTemplate.replace('{sku}', sku);
}
