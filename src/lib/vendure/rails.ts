import {graphql} from '@/graphql';
import type {FragmentOf} from '@/graphql';
import {ProductCardFragment} from './fragments';
import {toProductCardFragment} from './product-card-from-detail';
import type {QuantityDiscountLike, VariantDiscountLike} from '@/lib/product-discounts';

/**
 * Home-rail documents, written for *this* backend.
 *
 * `merchandising.ts` is a verbatim copy of the web storefront and declares
 * `$options: MerchandisingListOptions`. That type does not exist here — this
 * deployment predates the merchandising plugin — which is precisely why the
 * web storefront's `/deals` and `/new` pages 500. The copy is left untouched
 * so it stays diffable; these are the versions the app actually calls.
 *
 * Probed against api.dzduino.dz on 2026-08-16, re-probed 2026-08-17 after the
 * storefront deploy, which added the merchandising plugin and changed these
 * signatures:
 *
 * - `dealProducts(options: MerchandisingListOptions)` — was
 *   `ProductListOptions` until the deploy; the rename broke this query with a
 *   400 until it was updated. Still returns `totalItems: 0` (no product
 *   carries a deal flag yet), so an empty rail remains a correct render.
 * - `newArrivalProducts(options: MerchandisingListOptions)` — the new input
 *   type *does* carry `since`, so this resolver is finally callable (verified:
 *   3240 items for `since: 2026-01-01`). New arrivals still come from
 *   `products` sorted by `createdAt DESC`: that is the same set, needs no
 *   arbitrary cutoff date, and is already proven on device. Switching would be
 *   churn, not a fix.
 *
 * `graphqlUnsafe` mirrors the existing escape hatch: `dealProducts` was absent
 * from the `graphql-env.d.ts` snapshot when this was written. The snapshot
 * regenerated on 2026-09-15 has it, but the shared `RAIL_PRODUCT_FIELDS`
 * interpolation still keeps gql.tada from typing these documents. Results are
 * narrowed by the hand-written interfaces below, which is the one place in this
 * codebase where a declared shape is justified.
 */
const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

const RAIL_PRODUCT_FIELDS = `
    id
    name
    slug
    featuredAsset {
        id
        preview
    }
    variants {
        id
        sku
        priceWithTax
        stockLevel
        currencyCode
        customFields {
            compareAtPrice
        }
        discount {
            productDiscountId
            name
            priceWithTax
            originalPriceWithTax
            percentOff
            endsAt
            unitsRemaining
            maxQuantityPerOrder
            membersOnly
        }
        quantityDiscounts {
            minQuantity
            productDiscountId
            name
            priceWithTax
            percentOff
            endsAt
            membersOnly
        }
    }
`;

export const DealProductsRailQuery = graphqlUnsafe(`
    query DealProductsRail($options: MerchandisingListOptions) {
        dealProducts(options: $options) {
            totalItems
            items {${RAIL_PRODUCT_FIELDS}}
        }
    }
`);

/** New arrivals via `products`; see the note above on `newArrivalProducts`. */
export const NewArrivalsRailQuery = graphqlUnsafe(`
    query NewArrivalsRail($options: ProductListOptions) {
        products(options: $options) {
            totalItems
            items {${RAIL_PRODUCT_FIELDS}}
        }
    }
`);

export interface RailProduct {
    id: string;
    name: string;
    slug: string;
    featuredAsset?: {id: string; preview: string} | null;
    variants: Array<{
        id: string;
        sku?: string | null;
        priceWithTax: number;
        stockLevel: string;
        currencyCode?: string | null;
        customFields?: {compareAtPrice?: number | null} | null;
        /** Product-discounts plugin: the single-unit sale, priced for everyone. */
        discount?: VariantDiscountLike | null;
        quantityDiscounts?: QuantityDiscountLike[] | null;
    }>;
}

export interface RailProductList {
    totalItems: number;
    items: RailProduct[];
}

export interface DealProductsRailResult {
    dealProducts: RailProductList;
}

export interface NewArrivalsRailResult {
    products: RailProductList;
}

/** Options for a new-arrivals page: newest enabled products first. */
export function newArrivalsOptions(take: number, skip = 0) {
    return {take, skip, sort: {createdAt: 'DESC' as const}};
}

export function dealsOptions(take: number, skip = 0) {
    return {take, skip};
}

/**
 * Map `Product` rows onto the `ProductCard` search fragment the grids render.
 *
 * A product with no enabled variants is dropped rather than rendered at price
 * zero: the catalogue contains such rows (verified live), and "0 DZD" on the
 * home screen reads as a real, very wrong price.
 */
export function railItemsToCards(
    items: readonly RailProduct[],
    fallbackCurrencyCode = 'DZD',
): Array<FragmentOf<typeof ProductCardFragment>> {
    return items
        .filter(item => item.variants.length > 0)
        .map(item =>
            toProductCardFragment(
                {
                    id: item.id,
                    name: item.name,
                    slug: item.slug,
                    assets: item.featuredAsset
                        ? [{id: item.featuredAsset.id, preview: item.featuredAsset.preview}]
                        : [],
                    variants: item.variants.map(variant => ({
                        id: variant.id,
                        sku: variant.sku,
                        priceWithTax: variant.priceWithTax,
                        stockLevel: variant.stockLevel,
                        discount: variant.discount,
                        quantityDiscounts: variant.quantityDiscounts,
                    })),
                },
                item.variants[0]?.currencyCode ?? fallbackCurrencyCode,
            ),
        );
}
