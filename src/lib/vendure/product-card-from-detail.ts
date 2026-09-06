import type {FragmentOf} from '@/graphql';
import {ProductCardFragment} from './fragments';

export interface ProductCardBySlugSource {
    id: string;
    name: string;
    slug: string;
    /** Mobile-only: preferred over `assets[0]`, which is empty for a third of this catalogue. */
    featuredAsset?: {id: string; preview: string} | null;
    assets: Array<{id: string; preview: string}>;
    variants: Array<{id: string; priceWithTax: number; stockLevel: string}>;
}

/** Build a ProductCard search fragment from a shop `product` query result. */
export function toProductCardFragment(
    product: ProductCardBySlugSource,
    currencyCode: string,
): FragmentOf<typeof ProductCardFragment> {
    const prices = product.variants.map((variant) => variant.priceWithTax);
    const min = prices.length > 0 ? Math.min(...prices) : 0;
    const max = prices.length > 0 ? Math.max(...prices) : 0;
    const asset = product.featuredAsset ?? product.assets[0] ?? null;
    const inStock = product.variants.some((variant) => variant.stockLevel !== 'OUT_OF_STOCK');
    const preferredVariant =
        product.variants.find((variant) => variant.stockLevel !== 'OUT_OF_STOCK') ?? product.variants[0];

    return {
        productId: product.id,
        productName: product.name,
        slug: product.slug,
        productVariantId: preferredVariant?.id ?? '',
        inStock,
        productAsset: asset ? {id: asset.id, preview: asset.preview} : null,
        priceWithTax:
            min === max
                ? {__typename: 'SinglePrice', value: min}
                : {__typename: 'PriceRange', min, max},
        currencyCode,
    } as unknown as FragmentOf<typeof ProductCardFragment>;
}
