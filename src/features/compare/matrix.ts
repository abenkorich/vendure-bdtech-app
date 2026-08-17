/**
 * The comparison matrix.
 *
 * This is an electronics catalogue, so comparing products means comparing
 * *specifications* — not thumbnails side by side. The output of this module is
 * a real table: one row per attribute, one column per product, aligned so a
 * value can be read down a column. That alignment is the entire point; a set
 * of per-product cards showing the same facts is not a comparison, it is four
 * product pages next to each other.
 *
 * Rows are built by **union, not intersection**. If three of four products
 * declare a "Voltage" and the fourth does not, the row still appears with a
 * dash in the fourth column. Dropping the row would hide the most interesting
 * fact on the table (that one product does not specify it), and intersecting
 * four electronics products usually leaves nothing but the SKU.
 *
 * Pure, and free of React/React Native, so `tests/run.mjs` can bundle it.
 */

/**
 * The subset of a product document this module reads.
 *
 * Structural rather than `ProductDetail` from `@/lib/types` so this file stays
 * bundleable for the Node test harness: that module pulls in the GraphQL
 * documents, which reach `@/lib/env` and expo-constants. A real `ProductDetail`
 * satisfies this shape, so call sites pass one unchanged.
 */
export interface ComparableProduct {
    variants: readonly {
        sku: string;
        stockLevel: string;
        options: readonly {name: string; group?: {name: string} | null}[];
    }[];
    collections?: readonly {name: string}[] | null;
    customFields?: {averageRating?: number | null; reviewCount?: number | null} | null;
}

export interface CompareColumn {
    slug: string;
    name: string;
    priceWithTax: number;
    currencyCode: string;
    imageUrl?: string | null;
    /** Null while the product document is still loading. */
    detail: ComparableProduct | null;
}

export interface CompareRow {
    label: string;
    /** One cell per column, in column order. `null` renders as a dash. */
    values: (string | null)[];
    /** True when the columns do not all agree — the row worth looking at. */
    differs: boolean;
}

/** Cell placeholder. Rendering an empty cell looks like a layout bug. */
export const MISSING = null;

export interface AttributeLabels {
    sku: string;
    availability: string;
    inStock: string;
    outOfStock: string;
    lowStock: string;
    rating: string;
    reviews: string;
    variants: string;
    category: string;
}

/**
 * Attributes for one product, as an ordered label -> value map.
 *
 * The source is the same data the product screen's spec sheet uses: SKU, option
 * groups, stock and rating. This backend exposes no facet-based technical
 * attributes on the detail document, so option groups (voltage, size, colour,
 * pin count...) are where the real electronics specs live, and they are
 * included per group name rather than flattened into one "Options" row —
 * flattening would put "5 V, 10-pin" in a single cell that cannot be compared
 * against "3.3 V, 8-pin".
 */
function attributesOf(
    column: CompareColumn,
    labels: AttributeLabels,
): Map<string, string> {
    const attributes = new Map<string, string>();
    const detail = column.detail;
    if (!detail) return attributes;

    const variants = detail.variants ?? [];
    // A multi-variant product has no single SKU or stock level, so the
    // representative variant is the first; the variant count row makes that
    // visible rather than pretending the product is a single item.
    const variant = variants[0];

    if (variant?.sku) attributes.set(labels.sku, variant.sku);

    if (variants.length > 1) {
        attributes.set(labels.variants, String(variants.length));
    }

    for (const option of variant?.options ?? []) {
        const groupName = option.group?.name ?? option.name;
        attributes.set(groupName, option.name);
    }

    if (variant?.stockLevel) {
        attributes.set(labels.availability, stockLabel(variant.stockLevel, labels));
    }

    const rating = detail.customFields?.averageRating;
    const reviewCount = detail.customFields?.reviewCount;

    // A rating of 0.0 with no reviews is not a rating, it is the absence of
    // one, and showing "0.0 / 5" reads as a bad product rather than a new one.
    if (typeof rating === 'number' && typeof reviewCount === 'number' && reviewCount > 0) {
        attributes.set(labels.rating, `${rating.toFixed(1)} / 5`);
    }

    if (typeof reviewCount === 'number' && reviewCount > 0) {
        attributes.set(labels.reviews, String(reviewCount));
    }

    const category = detail.collections?.[0]?.name;
    if (category) attributes.set(labels.category, category);

    return attributes;
}

function stockLabel(stockLevel: string, labels: AttributeLabels): string {
    if (stockLevel === 'OUT_OF_STOCK') return labels.outOfStock;
    if (stockLevel === 'LOW_STOCK') return labels.lowStock;
    return labels.inStock;
}

/**
 * Build the matrix.
 *
 * Row order follows first appearance across the columns, so the leftmost (most
 * recently added) product's attribute order leads and later products append
 * whatever they add. That is stable across renders, which matters: rows
 * re-ordering themselves as a background fetch lands is disorienting in the
 * middle of a comparison.
 */
export function buildCompareMatrix(
    columns: readonly CompareColumn[],
    labels: AttributeLabels,
): CompareRow[] {
    const perColumn = columns.map(column => attributesOf(column, labels));

    const order: string[] = [];
    for (const attributes of perColumn) {
        for (const key of attributes.keys()) {
            if (!order.includes(key)) order.push(key);
        }
    }

    return order.map(label => {
        const values = perColumn.map(attributes => attributes.get(label) ?? MISSING);
        return {label, values, differs: rowDiffers(values)};
    });
}

/**
 * Whether the cells disagree.
 *
 * A missing value counts as a difference: "this one does not say" is exactly
 * the kind of thing a buyer wants highlighted, not smoothed over.
 */
function rowDiffers(values: readonly (string | null)[]): boolean {
    if (values.length < 2) return false;
    const first = values[0];
    return values.some(value => value !== first);
}

/** Rows where the products actually differ, for the "differences only" view. */
export function differingRows(rows: readonly CompareRow[]): CompareRow[] {
    return rows.filter(row => row.differs);
}
