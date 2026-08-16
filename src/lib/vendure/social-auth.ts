import {graphql} from '@/graphql';

/**
 * Temporary loose graphql helper until Shop API social-login schema
 * is deployed and `graphql-env.d.ts` is regenerated.
 */
const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

export type SocialLoginProvider = {
    code: string;
    clientId: string;
};

export const GetActiveSocialLoginProvidersQuery = graphqlUnsafe(`
    query GetActiveSocialLoginProviders {
        activeSocialLoginProviders {
            code
            clientId
        }
    }
`);

export const AuthenticateGoogleMutation = graphqlUnsafe(`
    mutation AuthenticateGoogle($token: String!) {
        authenticate(input: { google: { token: $token } }) {
            __typename
            ... on CurrentUser {
                id
                identifier
            }
            ... on ErrorResult {
                errorCode
                message
            }
        }
    }
`);
