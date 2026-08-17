import assert from 'node:assert/strict';
import {
    addSaved,
    isSaved,
    parseSaved,
    removeSaved,
    toggleSaved,
    COMPARE_LIMIT,
    WISHLIST_LIMIT,
    type SavedProduct,
} from '../src/features/wishlist/saved-core';
import {
    buildCompareMatrix,
    differingRows,
    type CompareColumn,
} from '../src/features/compare/matrix';

/**
 * Wishlist and compare.
 *
 * Both are device-local (this Shop API exposes no wishlist), so these rules are
 * the whole feature: nothing on a server will correct a duplicated entry or a
 * mis-built table row.
 */

function product(slug: string, extra: Partial<SavedProduct> = {}): SavedProduct {
    return {
        slug,
        name: slug,
        priceWithTax: 490000,
        currencyCode: 'DZD',
        savedAt: 1,
        ...extra,
    };
}

function testAddAndRemove(): void {
    const list = addSaved([], product('a'), WISHLIST_LIMIT);
    assert.equal(list.length, 1);
    assert.equal(isSaved(list, 'a'), true);
    assert.equal(isSaved(list, 'b'), false);

    // Most recent first: the list is read top-down.
    const two = addSaved(list, product('b'), WISHLIST_LIMIT);
    assert.deepEqual(two.map(i => i.slug), ['b', 'a']);

    assert.deepEqual(removeSaved(two, 'b').map(i => i.slug), ['a']);
    // Removing something absent is a no-op, not a throw.
    assert.deepEqual(removeSaved(two, 'zzz').map(i => i.slug), ['b', 'a']);
}

function testReSaveRefreshes(): void {
    const list = addSaved(
        [product('a', {priceWithTax: 100000}), product('b')],
        product('a', {priceWithTax: 250000}),
        WISHLIST_LIMIT,
    );

    // One entry, not two, and carrying the newer price snapshot.
    assert.equal(list.length, 2);
    assert.equal(list.filter(i => i.slug === 'a').length, 1);
    assert.equal(list[0].slug, 'a');
    assert.equal(list[0].priceWithTax, 250000);
}

function testLimits(): void {
    let list: SavedProduct[] = [];
    for (let index = 0; index < COMPARE_LIMIT; index += 1) {
        list = addSaved(list, product(`p${index}`), COMPARE_LIMIT);
    }
    assert.equal(list.length, COMPARE_LIMIT);

    // A fifth product must be refused *loudly*: a compare button that silently
    // does nothing is indistinguishable from a broken one.
    const rejected = toggleSaved(list, product('overflow'), COMPARE_LIMIT);
    assert.equal(rejected.atLimit, true);
    assert.equal(rejected.added, false);
    assert.equal(rejected.list.length, COMPARE_LIMIT);
    assert.equal(isSaved(rejected.list, 'overflow'), false);

    // Removing an item at the limit is always allowed.
    const toggledOff = toggleSaved(list, product('p0'), COMPARE_LIMIT);
    assert.equal(toggledOff.added, false);
    assert.equal(toggledOff.atLimit, false);
    assert.equal(toggledOff.list.length, COMPARE_LIMIT - 1);

    // The wishlist limit is far higher: it is a saved list, not a table.
    assert.ok(WISHLIST_LIMIT > COMPARE_LIMIT);
}

function testToggle(): void {
    const on = toggleSaved([], product('a'), COMPARE_LIMIT);
    assert.equal(on.added, true);
    assert.equal(isSaved(on.list, 'a'), true);

    const off = toggleSaved(on.list, product('a'), COMPARE_LIMIT);
    assert.equal(off.added, false);
    assert.equal(isSaved(off.list, 'a'), false);
}

function testParsing(): void {
    assert.deepEqual(parseSaved(undefined), []);
    assert.deepEqual(parseSaved('not json'), []);
    // A blob of the wrong shape must not take down the screen rendering it.
    assert.deepEqual(parseSaved('{"a":1}'), []);

    // Entries missing a usable price are dropped rather than rendered as NaN.
    const mixed = JSON.stringify([
        {slug: 'ok', name: 'OK', priceWithTax: 1000, currencyCode: 'DZD', savedAt: 1},
        {slug: 'bad', name: 'Bad', currencyCode: 'DZD'},
        {slug: 'nan', name: 'NaN', priceWithTax: 'lots', currencyCode: 'DZD'},
        null,
    ]);
    assert.deepEqual(parseSaved(mixed).map(i => i.slug), ['ok']);
}

/* ------------------------------------------------------------ compare table */

const LABELS = {
    sku: 'SKU',
    availability: 'Availability',
    inStock: 'In Stock',
    outOfStock: 'Out of Stock',
    lowStock: 'Low stock',
    rating: 'Rating',
    reviews: 'Reviews',
    variants: 'Variants',
    category: 'Category',
};

function column(slug: string, detail: CompareColumn['detail']): CompareColumn {
    return {slug, name: slug, priceWithTax: 100000, currencyCode: 'DZD', detail};
}

function testMatrix(): void {
    const a = column('a', {
        variants: [
            {
                sku: 'A-1',
                stockLevel: 'IN_STOCK',
                options: [{name: '5 V', group: {name: 'Voltage'}}],
            },
        ],
        collections: [{name: 'Relays'}],
        customFields: {averageRating: 4.5, reviewCount: 2},
    });

    const b = column('b', {
        variants: [
            {
                sku: 'B-1',
                stockLevel: 'OUT_OF_STOCK',
                options: [
                    {name: '12 V', group: {name: 'Voltage'}},
                    {name: '8', group: {name: 'Channels'}},
                ],
            },
        ],
        collections: [{name: 'Relays'}],
        customFields: null,
    });

    const rows = buildCompareMatrix([a, b], LABELS);
    const byLabel = new Map(rows.map(row => [row.label, row]));

    // Union, not intersection: "Channels" exists only on b and the row is still
    // there, with a dash for a. Dropping it would hide the most useful fact.
    assert.ok(byLabel.has('Channels'));
    assert.deepEqual(byLabel.get('Channels')!.values, [null, '8']);

    // Aligned down the column, in column order.
    assert.deepEqual(byLabel.get('Voltage')!.values, ['5 V', '12 V']);
    assert.deepEqual(byLabel.get('SKU')!.values, ['A-1', 'B-1']);
    assert.deepEqual(byLabel.get('Availability')!.values, ['In Stock', 'Out of Stock']);

    // Shared values are not flagged; differing ones are.
    assert.equal(byLabel.get('Category')!.differs, false);
    assert.equal(byLabel.get('Voltage')!.differs, true);
    // A missing value counts as a difference — "this one does not say" matters.
    assert.equal(byLabel.get('Rating')!.differs, true);

    const differing = differingRows(rows);
    assert.equal(differing.every(row => row.differs), true);
    assert.equal(differing.some(row => row.label === 'Category'), false);
}

function testMatrixEdgeCases(): void {
    // A column still loading contributes no rows but does not break the table.
    const rows = buildCompareMatrix([column('loading', null)], LABELS);
    assert.deepEqual(rows, []);

    // A single column has nothing to differ from.
    const single = buildCompareMatrix(
        [
            column('a', {
                variants: [{sku: 'A-1', stockLevel: 'IN_STOCK', options: []}],
            }),
        ],
        LABELS,
    );
    assert.equal(single.every(row => row.differs === false), true);

    // A multi-variant product says so, rather than implying its first variant
    // is the whole product.
    const multi = buildCompareMatrix(
        [
            column('m', {
                variants: [
                    {sku: 'M-1', stockLevel: 'IN_STOCK', options: []},
                    {sku: 'M-2', stockLevel: 'IN_STOCK', options: []},
                ],
            }),
        ],
        LABELS,
    );
    assert.equal(multi.find(row => row.label === 'Variants')?.values[0], '2');

    // Every row has exactly one cell per column, or the table misaligns.
    const three = buildCompareMatrix(
        [
            column('a', {variants: [{sku: 'A', stockLevel: 'IN_STOCK', options: []}]}),
            column('b', {variants: [{sku: 'B', stockLevel: 'IN_STOCK', options: []}]}),
            column('c', null),
        ],
        LABELS,
    );
    assert.equal(three.every(row => row.values.length === 3), true);
}

export async function run(): Promise<void> {
    testAddAndRemove();
    testReSaveRefreshes();
    testLimits();
    testToggle();
    testParsing();
    testMatrix();
    testMatrixEdgeCases();
}
