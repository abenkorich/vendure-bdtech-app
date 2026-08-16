import {graphql} from '@/graphql';
import type {FragmentOf} from '@/graphql';
import {ProductCardFragment} from './fragments';
import {toProductCardFragment, type ProductCardBySlugSource} from './product-card-from-detail';

/**
 * Temporary loose graphql helper until the Shop API merchandising schema
 * is deployed and `graphql-env.d.ts` is regenerated.
 */
const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

export const DealProductsQuery = graphqlUnsafe(`
    query DealProducts($options: MerchandisingListOptions) {
        dealProducts(options: $options) {
            totalItems
            items {
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
                    customFields {
                        compareAtPrice
                    }
                }
            }
        }
    }
`);

export const NewArrivalProductsQuery = graphqlUnsafe(`
    query NewArrivalProducts($options: MerchandisingListOptions) {
        newArrivalProducts(options: $options) {
            totalItems
            items {
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
                    customFields {
                        compareAtPrice
                    }
                }
            }
        }
    }
`);

export interface MerchandisingProductItem {
    id: string;
    name: string;
    slug: string;
    featuredAsset?: {id: string; preview: string} | null;
    variants: Array<{
        id: string;
        priceWithTax: number;
        stockLevel: string;
        customFields?: {compareAtPrice?: number | null} | null;
    }>;
}

export interface MerchandisingProductList {
    totalItems: number;
    items: MerchandisingProductItem[];
}

export type MerchandisingSort = {
    name?: 'ASC' | 'DESC';
    price?: 'ASC' | 'DESC';
    arrivalDate?: 'ASC' | 'DESC';
};

/** Map Shop API Product rows onto the ProductCard search fragment. */
export function merchandisingItemsToCards(
    items: MerchandisingProductItem[],
    currencyCode: string,
): Array<FragmentOf<typeof ProductCardFragment>> {
    return items.map((item) => {
        const source: ProductCardBySlugSource = {
            id: item.id,
            name: item.name,
            slug: item.slug,
            assets: item.featuredAsset
                ? [{id: item.featuredAsset.id, preview: item.featuredAsset.preview}]
                : [],
            variants: item.variants.map((variant) => ({
                id: variant.id,
                priceWithTax: variant.priceWithTax,
                stockLevel: variant.stockLevel,
            })),
        };
        return toProductCardFragment(source, currencyCode);
    });
}
