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
