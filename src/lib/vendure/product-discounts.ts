import {graphql} from '@/graphql';

/**
 * Member prices for signed-in shoppers.
 *
 * Written for this app, not copied. Catalogue documents go out without a
 * session token and are cached for everyone (and persisted to disk), so the
 * `discount` fields they carry are the prices open to everyone. A shopper in a
 * customer group can be entitled to more. These two queries, sent *with* the
 * token, are how the app finds out and overlays the member price on what is
 * already on screen; see `features/product/member-discounts.ts`.
 *
 * The selections under `discount` and `quantityDiscounts` repeat the ones in
 * `ProductCard` and `GetProductDetail` field for field, so an overlay entry has
 * exactly the type of the value it replaces.
 */

export const HasMemberProductDiscountsQuery = graphql(`
    query HasMemberProductDiscounts {
        hasMemberProductDiscounts
    }
`);

/** At most 100 products per call: the resolver's own cap. */
export const MEMBER_DISCOUNTS_MAX_PRODUCTS = 100;

export const MemberProductDiscountsQuery = graphql(`
    query MemberProductDiscounts($productIds: [ID!]!) {
        productDiscountsForProducts(productIds: $productIds) {
            productId
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
            variants {
                productVariantId
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
        }
    }
`);
