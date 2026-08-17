import assert from 'node:assert/strict';
import {print} from 'graphql';
import {
    GetActiveOrderQuery,
    GetActiveOrderForCheckoutQuery,
    GetCollectionProductsQuery,
    GetAllCollectionsFlatQuery,
    GetActiveCustomerQuery,
    GetCustomerAddressesQuery,
    GetCustomerOrdersQuery,
    GetEligibleShippingMethodsQuery,
    GetAvailableCountriesQuery,
    SearchOverlayProductsQuery,
    SearchPriceBoundQuery,
} from '@/lib/vendure/queries';
import {
    AddToCartMutation,
    AdjustCartItemMutation,
    RemoveFromCartMutation,
} from '@/lib/vendure/mutations';
import {DealProductsRailQuery, NewArrivalsRailQuery, dealsOptions, newArrivalsOptions}
    from '@/lib/vendure/rails';
import {BlogPostsQuery, BlogRailQuery, BlogPostBySlugQuery} from '@/lib/vendure/blog';
import {buildSearchInput, buildCollectionSearchInput} from '@/lib/search-input';

/**
 * Contract test for every document behind a data-layer hook.
 *
 * gql.tada validates against a *snapshot* (`graphql-env.d.ts`), so a backend
 * that drifts is invisible to `tsc` and surfaces as an empty screen. Several
 * of these documents are worse than that: the blog and rail documents are
 * built through the `graphqlUnsafe` escape hatch because their schema is not
 * in the snapshot at all, so this file is the *only* type checking they get.
 *
 * The cart section exercises real mutations against a guest session — add,
 * adjust, remove — and then cleans up after itself. It deliberately stops
 * short of any transition toward payment: that backend carries live payment
 * configuration and no order may ever be completed from a test.
 *
 * Cannot import `@/lib/env` (expo-constants pulls in React Native), so the
 * channel token is read from the environment, as in the sibling test.
 */

const API = process.env.EXPO_PUBLIC_VENDURE_SHOP_API_URL ?? 'https://api.dzduino.dz/shop-api';
const CHANNEL_TOKEN = process.env.EXPO_PUBLIC_VENDURE_CHANNEL_TOKEN ?? '';

interface GqlResponse {
    data?: Record<string, unknown>;
    errors?: Array<{message: string}>;
    token?: string;
}

/** Session token, so the cart sequence operates on one guest order. */
let sessionToken: string | undefined;

async function gql(
    document: unknown,
    variables: Record<string, unknown> = {},
): Promise<GqlResponse> {
    const response = await fetch(API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(CHANNEL_TOKEN ? {'vendure-token': CHANNEL_TOKEN} : {}),
            ...(sessionToken ? {Authorization: `Bearer ${sessionToken}`} : {}),
        },
        body: JSON.stringify({query: print(document as never), variables}),
        signal: AbortSignal.timeout(20000),
    });

    // Vendure rotates the session token when a guest order is created; mirror
    // what `api.ts` does so the cart sequence stays on one order.
    const newToken = response.headers.get('vendure-auth-token');
    if (newToken) sessionToken = newToken;

    return (await response.json()) as GqlResponse;
}

function ok(result: GqlResponse, label: string): Record<string, unknown> {
    // A missing database column is a broken *deployment*, not a broken query.
    // Saying so up front stops the next person reading "add to cart failed"
    // and going looking for the bug in this repo. Seen 2026-08-17:
    // `column Customer.customFieldsMarketingemailoptin does not exist`, a
    // custom field added to the Vendure config without running its migration,
    // which breaks every add-to-cart in production while browsing looks fine.
    const message = result.errors?.[0]?.message ?? '';
    if (/column .* does not exist/i.test(message)) {
        assert.fail(
            `${label}: the BACKEND is misconfigured, not this app — ${message}. ` +
                'Run the pending Vendure migration or drop the custom field.',
        );
    }

    assert.equal(result.errors, undefined, `${label}: ${JSON.stringify(result.errors)}`);
    assert.ok(result.data, `${label}: no data`);
    return result.data;
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

    // --- catalogue ------------------------------------------------------
    const collections = ok(
        await gql(GetAllCollectionsFlatQuery, {options: {take: 5}}),
        'collections flat',
    );
    const flat = collections.collections as {items: Array<{slug: string}>};
    assert.ok(flat.items.length > 0, 'the channel has collections');

    const collectionSlug = flat.items[0].slug;
    const collection = ok(
        await gql(GetCollectionProductsQuery, {
            slug: collectionSlug,
            input: buildCollectionSearchInput(collectionSlug, {take: 4, sort: 'price-asc'}),
        }),
        'collection products',
    );
    assert.ok(collection.collection, 'the collection resolves by slug');
    assert.ok(
        Array.isArray((collection.search as {items: unknown[]}).items),
        'the collection search input this app builds is accepted',
    );

    // The search-overlay input the type-ahead sends, verified end to end.
    const overlay = ok(
        await gql(SearchOverlayProductsQuery, {
            input: {term: 'esp', take: 5, groupByProduct: true},
        }),
        'search overlay',
    );
    assert.ok(Array.isArray((overlay.search as {items: unknown[]}).items));

    // Price bounds: two take:1 queries, one per direction.
    const bound = ok(
        await gql(SearchPriceBoundQuery, {
            input: buildSearchInput({term: 'esp', take: 1, sort: 'price-desc'}),
        }),
        'price bound',
    );
    const boundItems = (bound.search as {items: Array<{priceWithTax: {__typename: string}}>}).items;
    if (boundItems.length > 0) {
        assert.ok(
            ['SinglePrice', 'PriceRange'].includes(boundItems[0].priceWithTax.__typename),
            'the price union is one of the two shapes the slider handles',
        );
    }

    // --- home rails ------------------------------------------------------
    // These are the documents `merchandising.ts` gets wrong for this backend
    // (it declares MerchandisingListOptions, which does not exist here).
    const deals = ok(
        await gql(DealProductsRailQuery, {options: dealsOptions(6)}),
        'deal products rail',
    );
    assert.ok(
        typeof (deals.dealProducts as {totalItems: number}).totalItems === 'number',
        'dealProducts accepts ProductListOptions',
    );

    const newArrivals = ok(
        await gql(NewArrivalsRailQuery, {options: newArrivalsOptions(6)}),
        'new arrivals rail',
    );
    const arrivals = newArrivals.products as {totalItems: number; items: unknown[]};
    assert.ok(arrivals.totalItems > 0, 'new arrivals returns products');
    assert.ok(arrivals.items.length > 0, 'and the first page is not empty');

    // --- blog -------------------------------------------------------------
    // Built with `graphqlUnsafe`, so this is their only validation anywhere.
    const posts = ok(await gql(BlogPostsQuery, {options: {take: 3}}), 'blog posts');
    const postList = posts.blogPosts as {totalItems: number; items: Array<{slug: string}>};
    assert.ok(Array.isArray(postList.items), 'blogPosts returns a list');

    ok(await gql(BlogRailQuery, {options: {take: 3}}), 'blog rail');

    if (postList.items.length > 0) {
        const post = ok(
            await gql(BlogPostBySlugQuery, {slug: postList.items[0].slug}),
            'blog post by slug',
        );
        assert.ok(post.blogPost, 'a blog post resolves by slug');
    }

    // --- customer-scoped documents ---------------------------------------
    // As a guest these resolve to null rather than erroring; what is under test
    // is that the *documents* are still valid, which is what would break.
    ok(await gql(GetActiveCustomerQuery), 'active customer');
    ok(await gql(GetCustomerAddressesQuery), 'customer addresses');
    ok(await gql(GetCustomerOrdersQuery, {options: {take: 5}}), 'customer orders');
    ok(await gql(GetAvailableCountriesQuery), 'available countries');
    ok(await gql(GetEligibleShippingMethodsQuery), 'eligible shipping methods');

    // --- cart: a real optimistic round-trip -------------------------------
    // NEVER completed. Add, adjust, remove, and leave the order empty.
    //
    // Stock is real, and `inStock: true` only guarantees at least one unit, so
    // the first candidate can (and did, on the first run of this test) come
    // back as InsufficientStockError. Vendure still adds the available
    // quantity in that case, which is why the cleanup at the end removes every
    // line rather than only the one this test tracked.
    const searchForVariant = ok(
        await gql(SearchOverlayProductsQuery, {
            input: {take: 20, groupByProduct: false, inStock: true},
        }),
        'variant lookup',
    );
    const candidates = (
        searchForVariant.search as {items: Array<{productVariantId: string}>}
    ).items;
    assert.ok(candidates.length > 0, 'the catalogue has purchasable variants');

    const WANT = 2;
    let lineId: string | undefined;
    let addedQuantity = 0;

    for (const candidate of candidates) {
        const added = ok(
            await gql(AddToCartMutation, {
                variantId: candidate.productVariantId,
                quantity: WANT,
            }),
            'add to cart',
        );
        const addResult = added.addItemToOrder as {
            __typename: string;
            totalQuantity?: number;
            lines?: Array<{id: string; quantity: number; productVariant?: {id: string}}>;
            errorCode?: string;
            message?: string;
        };

        if (addResult.__typename === 'Order') {
            // Assert on the *line*, not the order total: a stock-limited
            // candidate earlier in the loop leaves a partial line behind, so
            // the order total is cumulative across attempts.
            const line = addResult.lines?.find(
                l => l.productVariant?.id === candidate.productVariantId,
            );
            assert.equal(
                line?.quantity,
                WANT,
                'the server agrees with the optimistic quantity for this line',
            );
            lineId = line?.id;
            addedQuantity = WANT;
            break;
        }

        // The only acceptable failure here is a stock limit; anything else
        // means the mutation or its error union has drifted.
        assert.equal(
            addResult.errorCode,
            'INSUFFICIENT_STOCK_ERROR',
            `add to cart returned ${addResult.__typename}: ${addResult.message ?? ''}`,
        );
    }

    assert.ok(lineId, 'at least one variant in the catalogue has 2 units in stock');

    // The active-order document the cart screen actually reads.
    const active = ok(await gql(GetActiveOrderQuery), 'active order');
    const activeOrder = active.activeOrder as {
        totalQuantity: number;
        subTotalWithTax: number;
        currencyCode: string;
        lines: Array<{id: string; unitPriceWithTax: number; quantity: number; linePriceWithTax: number}>;
    };
    assert.ok(activeOrder, 'the guest session carries an active order');
    assert.equal(activeOrder.currencyCode, 'DZD', 'the cart prices in DZD');
    assert.ok(
        activeOrder.totalQuantity >= addedQuantity,
        'the cart holds at least what this test added',
    );

    // The invariant the optimistic arithmetic relies on: line price is exactly
    // unit x quantity in minor units, with no rounding of its own.
    for (const line of activeOrder.lines) {
        assert.equal(
            line.linePriceWithTax,
            line.unitPriceWithTax * line.quantity,
            'linePriceWithTax === unitPriceWithTax * quantity (minor units, exact)',
        );
        assert.ok(
            Number.isInteger(line.unitPriceWithTax),
            'Money is an integer number of minor units',
        );
    }
    assert.equal(
        activeOrder.subTotalWithTax,
        activeOrder.lines.reduce((sum, l) => sum + l.linePriceWithTax, 0),
        'subTotalWithTax is the sum of line prices, as recomputeTotals assumes',
    );

    // The wider checkout document, read-only. No state transition is attempted:
    // this backend carries live payment configuration.
    ok(await gql(GetActiveOrderForCheckoutQuery), 'active order for checkout');

    // Adjusting down is always within stock, so this asserts unconditionally.
    const adjusted = ok(
        await gql(AdjustCartItemMutation, {lineId, quantity: 1}),
        'adjust cart item',
    );
    assert.equal(
        (adjusted.adjustOrderLine as {__typename: string}).__typename,
        'Order',
        'adjust returns an Order',
    );

    // Again per-line: `totalQuantity` is the whole cart, which may include a
    // partial line left by a stock-limited candidate above.
    const afterAdjust = ok(await gql(GetActiveOrderQuery), 'active order after adjust');
    const adjustedLine = (
        afterAdjust.activeOrder as {lines: Array<{id: string; quantity: number}>}
    ).lines.find(l => l.id === lineId);
    assert.equal(adjustedLine?.quantity, 1, 'the adjusted quantity is what was asked for');

    const removed = ok(await gql(RemoveFromCartMutation, {lineId}), 'remove from cart');
    assert.equal(
        (removed.removeOrderLine as {__typename: string}).__typename,
        'Order',
        'remove returns an Order',
    );

    // Leave nothing behind: a partial add from a stock-limited candidate above
    // may have left a line this test never tracked.
    const leftover = ok(await gql(GetActiveOrderQuery), 'active order after cleanup');
    const remaining = leftover.activeOrder as {lines: Array<{id: string}>} | null;
    for (const line of remaining?.lines ?? []) {
        ok(await gql(RemoveFromCartMutation, {lineId: line.id}), 'cleanup remove');
    }

    const final = ok(await gql(GetActiveOrderQuery), 'active order is empty');
    const finalOrder = final.activeOrder as {totalQuantity: number} | null;
    assert.ok(
        finalOrder === null || finalOrder.totalQuantity === 0,
        'the test leaves an empty cart behind',
    );
}
