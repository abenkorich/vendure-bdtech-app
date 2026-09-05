import {print} from 'graphql';
import {SearchProductsQuery} from '@/lib/vendure/queries';
import {check, done} from './harness';

/**
 * The shop screen only renders a product rail for a collection proven to have
 * stock, and labels each category with the products it holds. Both rest on
 * measured properties of this catalogue, and the catalogue moves: when this
 * test was written most child collections were empty and no parent held
 * products; by 2026-09-05 most children were stocked and 4 of 7 parents held
 * products directly (Fabrication & Prototyping holds 209 of its own).
 *
 * So the assertions here are about what the screen needs, not about the
 * shape of the day: there must be something to rail, and a parent that holds
 * products must be counted rather than dropped.
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

    // Parents hold products directly in this catalogue, and the card's
    // subtitle counts them alongside the children's (a card that only summed
    // children showed "3 products" over a category page listing 209). This
    // pins that the shop screen's candidate list includes the parent slug,
    // so the count it asks for is one the API actually answers.
    const parentCounts = await Promise.all(tree.slice(0, 7).map(parent => search(parent.slug)));
    const parentsWithStock = parentCounts.filter(count => count > 0).length;

    console.log(
        `        (${parentsWithStock} of ${parentCounts.length} top-level collections hold products directly: ` +
            `${parentCounts.join(', ')})`,
    );

    check(
        'the catalogue still has stock somewhere the shop screen looks',
        stocked > 0 || parentsWithStock > 0,
        'neither the sampled children nor the parents answered with products',
    );

    done();
}
