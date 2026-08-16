import {graphql} from '@/graphql';

/**
 * Temporary loose graphql helper until the Shop API review schema
 * is deployed and `graphql-env.d.ts` is regenerated.
 */
const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

export const ProductReviewsQuery = graphqlUnsafe(`
    query ProductReviews($productId: ID!, $options: ProductReviewListOptions) {
        productReviews(productId: $productId, options: $options) {
            items {
                id
                createdAt
                rating
                title
                body
                verifiedPurchase
                authorName
            }
            totalItems
        }
    }
`);

export const SubmitProductReviewMutation = graphqlUnsafe(`
    mutation SubmitProductReview($input: SubmitProductReviewInput!) {
        submitProductReview(input: $input) {
            id
            status
            rating
            title
            body
        }
    }
`);

export interface ProductReviewItem {
    id: string;
    createdAt: string;
    rating: number;
    title?: string | null;
    body: string;
    verifiedPurchase: boolean;
    authorName: string;
}
