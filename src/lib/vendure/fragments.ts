import { graphql } from '@/graphql';

export const ProductCardFragment = graphql(`
    fragment ProductCard on SearchResult {
        productId
        productName
        slug
        productVariantId
        sku
        inStock
        productAsset {
            id
            preview
        }
        priceWithTax {
            __typename
            ... on PriceRange {
                min
                max
            }
            ... on SinglePrice {
                value
            }
        }
        currencyCode
        # Mobile-only addition: the product-discounts plugin's sale summary, so
        # a card can strike the real price. Null when nothing is on sale. The
        # rails build this shape from variants (lib/product-discounts.ts) and
        # member prices overlay it (lib/vendure/product-discounts.ts), both
        # with this exact selection.
        discount {
            productDiscountId
            name
            fromPriceWithTax
            fromOriginalPriceWithTax
            maxPercentOff
            endsAt
            discountedVariantCount
            membersOnly
            quantityDiscount {
                minQuantity
                percentOff
            }
        }
    }
`);

export const SearchOverlayFragment = graphql(`
    fragment SearchOverlayResult on SearchResult {
        ...ProductCard
        inStock
    }
`, [ProductCardFragment]);

export const ActiveCustomerFragment = graphql(`
    fragment ActiveCustomer on Customer {
        id
        firstName
        lastName
        emailAddress
        phoneNumber
    }
`);
