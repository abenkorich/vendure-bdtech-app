import { graphql } from '@/graphql';
import { ActiveCustomerFragment, ProductCardFragment, SearchOverlayFragment } from './fragments';

/** Top-level collection tree for nav, customizer pickers, category grids, etc.
 * Uses `topLevelOnly` — never hardcode `parentId: "1"` (root id varies after import). */
export const GetTopCollectionsQuery = graphql(`
    query GetTopCollections {
        collections(options: { topLevelOnly: true, take: 100 }) {
            items {
                id
                name
                slug
                description
                featuredAsset {
                    id
                    preview
                }
                children {
                    id
                    name
                    slug
                    description
                    featuredAsset {
                        id
                        preview
                    }
                    children {
                        id
                        name
                        slug
                        description
                        featuredAsset {
                            id
                            preview
                        }
                    }
                }
            }
        }
    }
`);

/**
 * Flat collection list for customizer pickers (unlimited nesting).
 * Prefer this over nested `children` in GetTopCollections — GraphQL nesting
 * cannot express arbitrary depth.
 */
export const GetAllCollectionsFlatQuery = graphql(`
    query GetAllCollectionsFlat($options: CollectionListOptions) {
        collections(options: $options) {
            totalItems
            items {
                id
                name
                slug
                position
                parentId
            }
        }
    }
`);

export const GetActiveCustomerQuery = graphql(`
    query GetActiveCustomer {
        activeCustomer {
            ...ActiveCustomer
        }
    }
`, [ActiveCustomerFragment]);

export const SearchProductsQuery = graphql(`
    query SearchProducts($input: SearchInput!) {
        search(input: $input) {
            totalItems
            items {
                ...ProductCard
            }
            facetValues {
                count
                facetValue {
                    id
                    name
                    facet {
                        id
                        name
                    }
                }
            }
        }
    }
`, [ProductCardFragment]);

export const SearchOverlayProductsQuery = graphql(`
    query SearchOverlayProducts($input: SearchInput!) {
        search(input: $input) {
            items {
                ...SearchOverlayResult
            }
        }
    }
`, [SearchOverlayFragment]);

/** Lightweight collection product total for customizer info text. */
export const SearchCollectionProductCountQuery = graphql(`
    query SearchCollectionProductCount($input: SearchInput!) {
        search(input: $input) {
            totalItems
        }
    }
`);

/**
 * Single cheapest/priciest result used to derive the price slider's bounds.
 *
 * `SearchInput` has no price filter, so the bounds cannot come from a facet;
 * they are read off a `take: 1` query sorted by price in each direction, which
 * is exact and far cheaper than fetching the whole result set.
 */
export const SearchPriceBoundQuery = graphql(`
    query SearchPriceBound($input: SearchInput!) {
        search(input: $input) {
            items {
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
            }
        }
    }
`);

export const GetProductDetailQuery = graphql(`
    query GetProductDetail($slug: String!) {
        product(slug: $slug) {
            id
            name
            description
            slug
            # Mobile-only addition to the copied document: 109 of the 300 newest
            # products (measured 2026-09-05) carry a featuredAsset with an
            # empty 'assets' list, so a gallery built from 'assets' alone showed
            # a placeholder for a third of the catalogue while the card next to
            # it showed the photo. See features/product/gallery-images.ts.
            featuredAsset {
                id
                preview
                source
            }
            assets {
                id
                preview
                source
            }
            variants {
                id
                name
                sku
                priceWithTax
                stockLevel
                options {
                    id
                    code
                    name
                    groupId
                    group {
                        id
                        code
                        name
                    }
                }
            }
            optionGroups {
                id
                code
                name
                options {
                    id
                    code
                    name
                }
            }
            collections {
                id
                name
                slug
                parent {
                    id
                }
                breadcrumbs {
                    id
                    name
                    slug
                }
            }
            customFields {
                averageRating
                reviewCount
            }
        }
    }
`);

/** Minimal product lookup for hand-picked carousel rails (by slug). */
export const GetProductCardBySlugQuery = graphql(`
    query GetProductCardBySlug($slug: String!) {
        product(slug: $slug) {
            id
            name
            slug
            assets {
                id
                preview
            }
            variants {
                id
                priceWithTax
                stockLevel
            }
        }
    }
`);

export const GetActiveOrderQuery = graphql(`
    query GetActiveOrder {
        activeOrder {
            id
            code
            state
            totalQuantity
            subTotal
            subTotalWithTax
            shipping
            shippingWithTax
            total
            totalWithTax
            currencyCode
            couponCodes
            discounts {
                description
                amountWithTax
            }
            lines {
                id
                productVariant {
                    id
                    name
                    sku
                    product {
                        id
                        name
                        slug
                        featuredAsset {
                            id
                            preview
                        }
                    }
                }
                unitPriceWithTax
                quantity
                linePriceWithTax
            }
        }
    }
`);

export const GetActiveOrderForCheckoutQuery = graphql(`
    query GetActiveOrderForCheckout {
        activeOrder {
            id
            code
            state
            totalQuantity
            subTotal
            subTotalWithTax
            shipping
            shippingWithTax
            total
            totalWithTax
            currencyCode
            couponCodes
            customer {
                id
                firstName
                lastName
                emailAddress
                phoneNumber
            }
            shippingAddress {
                fullName
                company
                streetLine1
                streetLine2
                city
                province
                postalCode
                country
                phoneNumber
            }
            billingAddress {
                fullName
                company
                streetLine1
                streetLine2
                city
                province
                postalCode
                country
                phoneNumber
            }
            shippingLines {
                shippingMethod {
                    id
                    code
                    name
                    description
                }
                priceWithTax
            }
            discounts {
                description
                amountWithTax
            }
            lines {
                id
                productVariant {
                    id
                    name
                    sku
                    product {
                        id
                        name
                        slug
                        featuredAsset {
                            id
                            preview
                        }
                    }
                }
                unitPriceWithTax
                quantity
                linePriceWithTax
            }
        }
    }
`);

export const GetCustomerAddressesQuery = graphql(`
    query GetCustomerAddresses {
        activeCustomer {
            id
            addresses {
                id
                fullName
                company
                streetLine1
                streetLine2
                city
                province
                postalCode
                country {
                    id
                    code
                    name
                }
                phoneNumber
                defaultShippingAddress
                defaultBillingAddress
            }
        }
    }
`);

export const GetEligibleShippingMethodsQuery = graphql(`
    query GetEligibleShippingMethods {
        eligibleShippingMethods {
            id
            name
            code
            description
            priceWithTax
        }
    }
`);

export const GetEligiblePaymentMethodsQuery = graphql(`
    query GetEligiblePaymentMethods {
        eligiblePaymentMethods {
            id
            name
            code
            description
            isEligible
            eligibilityMessage
        }
    }
`);

export const GetAvailableCountriesQuery = graphql(`
    query GetAvailableCountries {
        availableCountries {
            id
            code
            name
        }
    }
`);

export const GetCustomerOrdersQuery = graphql(`
    query GetCustomerOrders($options: OrderListOptions) {
        activeCustomer {
            id
            orders(options: $options) {
                totalItems
                items {
                    id
                    code
                    state
                    totalWithTax
                    currencyCode
                    createdAt
                    updatedAt
                    lines {
                        id
                        productVariant {
                            id
                            name
                            product {
                                id
                                name
                                featuredAsset {
                                    id
                                    preview
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`);

export const GetOrderDetailQuery = graphql(`
    query GetOrderDetail($code: String!) {
        orderByCode(code: $code) {
            id
            code
            state
            active
            createdAt
            updatedAt
            totalQuantity
            subTotal
            subTotalWithTax
            shipping
            shippingWithTax
            total
            totalWithTax
            currencyCode
            customer {
                id
                firstName
                lastName
                emailAddress
            }
            shippingAddress {
                fullName
                company
                streetLine1
                streetLine2
                city
                province
                postalCode
                country
                phoneNumber
            }
            billingAddress {
                fullName
                company
                streetLine1
                streetLine2
                city
                province
                postalCode
                country
                phoneNumber
            }
            shippingLines {
                shippingMethod {
                    id
                    code
                    name
                    description
                }
                priceWithTax
            }
            payments {
                id
                method
                amount
                state
                transactionId
                createdAt
            }
            lines {
                id
                productVariant {
                    id
                    name
                    sku
                    product {
                        id
                        name
                        slug
                        featuredAsset {
                            id
                            preview
                        }
                    }
                }
                unitPriceWithTax
                quantity
                linePriceWithTax
            }
            discounts {
                description
                amountWithTax
            }
            fulfillments {
                id
                state
                method
                trackingCode
                createdAt
                updatedAt
            }
        }
    }
`);

export const GetActiveChannelQuery = graphql(`
    query GetActiveChannel {
        activeChannel {
            id
            code
            defaultLanguageCode
            availableLanguageCodes
            defaultCurrencyCode
            availableCurrencyCodes
        }
    }
`);

export const GetCollectionProductsQuery = graphql(`
    query GetCollectionProducts($slug: String!, $input: SearchInput!) {
        collection(slug: $slug) {
            id
            name
            slug
            description
            featuredAsset {
                id
                preview
            }
            breadcrumbs {
                id
                name
                slug
            }
            children {
                id
                name
                slug
                featuredAsset {
                    id
                    preview
                }
            }
        }
        search(input: $input) {
            totalItems
            items {
                ...ProductCard
            }
        }
    }
`, [ProductCardFragment]);
