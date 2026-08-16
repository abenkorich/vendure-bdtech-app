import {graphql} from '@/graphql';

/**
 * Temporary loose graphql helper until the Shop API stock-alert schema
 * is deployed and `graphql-env.d.ts` is regenerated.
 */
const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

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
