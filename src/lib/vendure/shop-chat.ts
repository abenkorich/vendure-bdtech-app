import {graphql} from '@/graphql';

const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

export const AiShopChatSettingsQuery = graphqlUnsafe(`
    query AiShopChatSettings {
        aiShopChatSettings {
            enabled
            welcomeMessage
        }
    }
`);

export const AiShopChatMutation = graphqlUnsafe(`
    mutation AiShopChat($input: AiShopChatInput!) {
        aiShopChat(input: $input) {
            reply
            suggestedProducts {
                productId
                name
                slug
            }
        }
    }
`);

export interface AiShopChatSettings {
    enabled: boolean;
    welcomeMessage?: string | null;
}

export interface AiShopChatSuggestedProduct {
    productId: string;
    name: string;
    slug: string;
}

export interface AiShopChatResult {
    reply: string;
    suggestedProducts: AiShopChatSuggestedProduct[];
}
