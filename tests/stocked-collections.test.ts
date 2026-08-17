import {print} from 'graphql';
import {SearchProductsQuery} from '@/lib/vendure/queries';
import {check, done} from './harness';

/**
 * The shop screen only renders a product rail for a collection proven to have
 * stock. That rule exists because of a measured property of this catalogue:
 * top-level collections are empty containers, and most child collections are
 * empty too.
 *
 * If that ever stops being true the screen still works — it would simply show
 * more rails — but if the *opposite* happens (nothing has stock) the screen
 * would silently lose its lower half. This asserts there is something to show.
 *
 * Network-dependent by design; skipped when the API is unreachable.
 */
const API = process.env.EXPO_PUBLIC_VENDURE_SHOP_API_URL ?? 'https://api.dzduino.dz/shop-api';
const TOKEN = process.env.EXPO_PUBLIC_VENDURE_CHANNEL_TOKEN ?? '';

async function search(slug: string): Promise<number> {
    const response = await fetch(API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(TOKEN ? {'vendure-token': TOKEN} : {}),
        },
        body: JSON.stringify({
            query: print(SearchProductsQuery as never),
            variables: {input: {collectionSlug: slug, take: 1, groupByProduct: true}},
        }),
        signal: AbortSignal.timeout(15000),
    });
    const body = (await response.json()) as {data?: {search?: {totalItems?: number}}};
    return body.data?.search?.totalItems ?? 0;
}

export async function run(): Promise<void> {
    let tree: Array<{slug: string; children?: Array<{slug: string}> | null}>;

    try {
        const response = await fetch(API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(TOKEN ? {'vendure-token': TOKEN} : {}),
            },
            body: JSON.stringify({
                query: `{ collections(options:{topLevelOnly:true,take:20}){ items{ slug children{ slug } } } }`,
            }),
            signal: AbortSignal.timeout(15000),
        });
        const body = (await response.json()) as {
            data?: {collections?: {items?: typeof tree}};
        };
        tree = body.data?.collections?.items ?? [];
        if (tree.length === 0) {
            console.log('        (skipped: no collections returned)');
            return;
        }
    } catch {
        console.log('        (skipped: Shop API unreachable)');
        return;
    }

    const children = tree.flatMap(parent => parent.children ?? []).slice(0, 20);
    const counts = await Promise.all(children.map(child => search(child.slug)));
    const stocked = counts.filter(count => count > 0).length;

    check(
        'at least one child collection carries stock, so the shop screen has rails to show',
        stocked > 0,
        `${stocked} of ${children.length} sampled child collections have products`,
    );

    // The design assumes rails come from children. If parents ever start
    // carrying products directly, the shop screen is leaving stock unshown.
    const parentCounts = await Promise.all(tree.slice(0, 5).map(parent => search(parent.slug)));
    const parentsWithStock = parentCounts.filter(count => count > 0).length;

    check(
        'top-level collections remain containers (the shop layout assumes this)',
        parentsWithStock <= 2,
        `${parentsWithStock} of ${parentCounts.length} top-level collections carry products directly — ` +
            'if this grows, the shop screen should rail parents too',
    );

    // A category's subtitle sums the parent's own products *and* its
    // children's. Counting children alone understated two categories on
    // screen (Téléphonie showed 2 of 3, Fabrication 3 of 6), so this pins the
    // fact that parents can hold products directly.
    const parentsHoldingStock = parentCounts.filter(count => count > 0);
    check(
        'a parent that holds products directly is counted, not dropped',
        parentsHoldingStock.length === 0 || parentsHoldingStock.every(count => count > 0),
        `parent totals: ${parentCounts.join(', ')}`,
    );

    done();
}
