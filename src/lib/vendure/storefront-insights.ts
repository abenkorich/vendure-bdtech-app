import {graphql} from '@/graphql';

// Mirrors the Next storefront's src/lib/vendure/storefront-insights.ts. The
// mutation is newer than the app's schema snapshot, hence the unsafe cast.
const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

/** Served by the platform's CustomerInsightsPlugin; always returns true. */
export const TrackStorefrontActivityMutation = graphqlUnsafe(`
    mutation TrackStorefrontActivity($input: StorefrontTrackInput!) {
        trackStorefrontActivity(input: $input)
    }
`);
