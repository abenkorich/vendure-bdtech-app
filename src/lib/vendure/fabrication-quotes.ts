import {graphql} from '@/graphql';

const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

export const SubmitFabricationQuoteMutation = graphqlUnsafe(`
    mutation SubmitFabricationQuoteRequest($input: SubmitFabricationQuoteInput!) {
        submitFabricationQuoteRequest(input: $input) {
            id
            status
            serviceType
            estimatedCents
            currencyCode
        }
    }
`);

export const MyFabricationQuotesQuery = graphqlUnsafe(`
    query MyFabricationQuoteRequests($options: FabricationQuoteRequestListOptions) {
        myFabricationQuoteRequests(options: $options) {
            items {
                id
                createdAt
                serviceType
                status
                estimatedCents
                quotedCents
                currencyCode
                customerNotes
            }
            totalItems
        }
    }
`);

export interface FabricationQuoteListItem {
    id: string;
    createdAt: string;
    serviceType: string;
    status: string;
    estimatedCents?: number | null;
    quotedCents?: number | null;
    currencyCode?: string | null;
    customerNotes?: string | null;
}
