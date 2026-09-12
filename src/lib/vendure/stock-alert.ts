import {graphql} from '@/graphql';

/**
 * Back-in-stock alerts.
 *
 * The same `subscribeToStockAlert` the website calls — one plugin, one
 * subscription table, so an alert placed on the phone and one placed on the
 * website are the same row and the customer is not mailed twice.
 *
 * Verified against the live Shop API on 2026-09-09: `SubscribeToStockAlertInput`
 * takes `variantId: ID!` and an optional `email`, and answers with a
 * `StockAlertSubscription` carrying `id`, `status` and `expiresAt`. The email
 * is optional because a signed-in request is attributed to the customer by
 * the backend; it is only sent when a guest types one.
 *
 * Same loose helper as `captcha.ts` and `social-auth.ts`: this app's
 * `graphql-env.d.ts` predates the plugin, so gql.tada cannot type the document
 * until the schema is regenerated.
 */
const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

export interface StockAlertSubscription {
    id: string;
    status: string;
    expiresAt?: string | null;
}

export const SubscribeToStockAlertMutation = graphqlUnsafe(`
    mutation SubscribeToStockAlert($input: SubscribeToStockAlertInput!) {
        subscribeToStockAlert(input: $input) {
            id
            status
            expiresAt
        }
    }
`);

export const UnsubscribeFromStockAlertMutation = graphqlUnsafe(`
    mutation UnsubscribeFromStockAlert($input: UnsubscribeFromStockAlertInput!) {
        unsubscribeFromStockAlert(input: $input)
    }
`);
