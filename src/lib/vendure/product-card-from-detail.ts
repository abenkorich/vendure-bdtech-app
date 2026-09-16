import type {FragmentOf} from '@/graphql';
import {ProductCardFragment} from './fragments';
import {preferredStockQuantity} from '@/lib/product-card-extras';
import {
    summarizeVariantDiscounts,
    type QuantityDiscountLike,
    type VariantDiscountLike,
} from '@/lib/product-discounts';

export interface ProductCardBySlugSource {
    id: string;
    name: string;
    slug: string;
    /** Mobile-only: preferred over `assets[0]`, which is empty for a third of this catalogue. */
    featuredAsset?: {id: string; preview: string} | null;
    assets: Array<{id: string; preview: string}>;
    variants: Array<{
        id: string;
        sku?: string | null;
        priceWithTax: number;
        stockLevel: string;
        /** Mobile-only: product-discounts plugin fields, summarised into the card's `discount`. */
        discount?: VariantDiscountLike | null;
        quantityDiscounts?: readonly QuantityDiscountLike[] | null;
    }>;
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
        sku: preferredVariant?.sku ?? null,
        // Only when the channel returns a real count; see product-card-extras.
        stockQuantity: preferredStockQuantity(product.variants),
        inStock,
        productAsset: asset ? {id: asset.id, preview: asset.preview} : null,
        priceWithTax:
            min === max
                ? {__typename: 'SinglePrice', value: min}
                : {__typename: 'PriceRange', min, max},
        currencyCode,
        // Mobile-only: a `products` row has no `SearchResult.discount`, so the
        // summary the search index would return is built from the variants by
        // the server's own rule. Sources without discount fields get null.
        discount: summarizeVariantDiscounts(product.variants),
    } as unknown as FragmentOf<typeof ProductCardFragment>;
}
