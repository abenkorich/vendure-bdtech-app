import assert from 'node:assert/strict';
import {print} from 'graphql';
import {
    SearchProductsQuery,
    GetTopCollectionsQuery,
    GetProductDetailQuery,
    GetActiveChannelQuery,
} from '@/lib/vendure/queries';

/**
 * Contract test: the GraphQL documents copied from the web storefront must
 * still be valid against the live Shop API.
 *
 * This is the highest-value test in the project. The documents were copied
 * wholesale, and a schema drift would surface as an empty screen at runtime
 * rather than as a type error, since gql.tada validates against a *snapshot*
 * (`graphql-env.d.ts`) and not the running server.
 *
 * Network-dependent by design. Skipped when the API is unreachable, so an
 * offline `npm test` reports honestly instead of failing for the wrong reason.
 *
 * Note this deliberately does not import `@/lib/env`: that pulls in
 * expo-constants and therefore React Native, which cannot be bundled for Node.
 * Anything importing RN belongs in a device test, not here.
 */

const API = process.env.EXPO_PUBLIC_VENDURE_SHOP_API_URL ?? 'https://api.dzduino.dz/shop-api';
const CHANNEL_TOKEN = process.env.EXPO_PUBLIC_VENDURE_CHANNEL_TOKEN ?? '';

async function gql(document: unknown, variables: Record<string, unknown> = {}) {
    const response = await fetch(API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(CHANNEL_TOKEN ? {'vendure-token': CHANNEL_TOKEN} : {}),
        },
        body: JSON.stringify({query: print(document as never), variables}),
    });
    return (await response.json()) as {
        data?: Record<string, unknown>;
        errors?: Array<{message: string}>;
    };
}

async function reachable(): Promise<boolean> {
    try {
        const response = await fetch(API, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({query: '{ activeChannel { code } }'}),
            signal: AbortSignal.timeout(8000),
        });
        return response.ok;
    } catch {
        return false;
    }
}

export async function run(): Promise<void> {
    if (!(await reachable())) {
        console.log('        (skipped: Shop API unreachable)');
        return;
    }

    const search = await gql(SearchProductsQuery, {
        input: {take: 3, groupByProduct: true},
    });
    assert.equal(search.errors, undefined, `search: ${JSON.stringify(search.errors)}`);
    const searchResult = search.data?.search as {items: Array<{slug: string}>; totalItems: number};
    assert.ok(Array.isArray(searchResult.items), 'search returns items');
    assert.ok(searchResult.totalItems > 0, 'the catalogue is not empty');

    const collections = await gql(GetTopCollectionsQuery);
    assert.equal(
        collections.errors,
        undefined,
        `collections: ${JSON.stringify(collections.errors)}`,
    );

    // The app assumes a single-currency (DZD) trilingual channel; assert it
    // rather than discovering otherwise through mis-formatted prices.
    const channel = await gql(GetActiveChannelQuery);
    assert.equal(channel.errors, undefined, `channel: ${JSON.stringify(channel.errors)}`);
    const active = channel.data?.activeChannel as {
        defaultCurrencyCode: string;
        availableLanguageCodes: string[];
    };
    assert.equal(active.defaultCurrencyCode, 'DZD', 'channel currency is DZD');
    for (const locale of ['en', 'fr', 'ar']) {
        assert.ok(
            active.availableLanguageCodes.includes(locale),
            `channel serves ${locale}`,
        );
    }

    // Product detail is the widest document (variants, facets, assets, custom
    // fields), so it is the most likely to break on a schema change.
    const firstSlug = searchResult.items[0]?.slug;
    assert.ok(firstSlug, 'search results carry a slug');

    const product = await gql(GetProductDetailQuery, {slug: firstSlug});
    assert.equal(product.errors, undefined, `product: ${JSON.stringify(product.errors)}`);
    assert.ok(product.data?.product, 'product detail resolves by slug');
}
