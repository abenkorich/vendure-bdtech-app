import {graphql} from '@/graphql';
import type {FragmentOf} from '@/graphql';
import {ProductCardFragment} from './fragments';
import {toProductCardFragment} from './product-card-from-detail';

/**
 * Home-rail documents, written for *this* backend.
 *
 * `merchandising.ts` is a verbatim copy of the web storefront and declares
 * `$options: MerchandisingListOptions`. That type does not exist here — this
 * deployment predates the merchandising plugin — which is precisely why the
 * web storefront's `/deals` and `/new` pages 500. The copy is left untouched
 * so it stays diffable; these are the versions the app actually calls.
 *
 * Probed against api.dzduino.dz on 2026-08-16:
 *
 * - `dealProducts(options: ProductListOptions)` — valid, currently returns
 *   `totalItems: 0` (no product carries a deal flag yet). An empty rail is a
 *   correct render, not a bug to chase.
 * - `newArrivalProducts(options: ProductListOptions)` — **unusable**. The
 *   resolver rejects every call with `newArrivalProducts requires
 *   options.since`, but `since` is not a field of `ProductListOptions`, so
 *   there is no input that satisfies it. New arrivals therefore come from
 *   `products` sorted by `createdAt DESC`, which is what the rail means anyway.
 *
 * `graphqlUnsafe` mirrors the existing escape hatch: `dealProducts` is absent
 * from the `graphql-env.d.ts` snapshot, so gql.tada cannot type it. Results are
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
        priceWithTax
        stockLevel
        currencyCode
        customFields {
            compareAtPrice
        }
    }
`;

export const DealProductsRailQuery = graphqlUnsafe(`
    query DealProductsRail($options: ProductListOptions) {
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
        priceWithTax: number;
        stockLevel: string;
        currencyCode?: string | null;
        customFields?: {compareAtPrice?: number | null} | null;
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
                        priceWithTax: variant.priceWithTax,
                        stockLevel: variant.stockLevel,
                    })),
                },
                item.variants[0]?.currencyCode ?? fallbackCurrencyCode,
            ),
        );
}
