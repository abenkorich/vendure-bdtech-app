import assert from 'node:assert/strict';
import {
    availableOptionIds,
    findVariant,
    initialSelection,
    selectOption,
    selectionForVariant,
    stockState,
    type VariantLike,
} from '../src/features/product/variant-selection';

/**
 * Variant selection.
 *
 * This is the logic that decides which product id goes into the cart, and it is
 * the part of the product screen that a Node test can reach (the screen itself
 * imports React Native and cannot be bundled here — see AGENTS.md).
 *
 * The fixture is deliberately *sparse*: a 2x2 option matrix with one
 * combination missing, which is the real shape of this catalogue (a 10k
 * resistor in 0805 exists, in through-hole it does not) and the case an
 * unguarded picker gets wrong.
 */

const COLOR = 'g-color';
const SIZE = 'g-size';

function variant(
    id: string,
    color: string,
    size: string,
    stockLevel = 'IN_STOCK',
    price = 100000,
): VariantLike {
    return {
        id,
        name: `${color} / ${size}`,
        sku: `SKU-${id}`,
        priceWithTax: price,
        stockLevel,
        options: [
            {id: `o-${color}`, name: color, groupId: COLOR},
            {id: `o-${size}`, name: size, groupId: SIZE},
        ],
    };
}

// red/S, red/L, blue/S — blue/L does not exist.
const VARIANTS: VariantLike[] = [
    variant('1', 'red', 'S', 'OUT_OF_STOCK'),
    variant('2', 'red', 'L'),
    variant('3', 'blue', 'S'),
];

export async function run(): Promise<void> {
    /* --- resolving a selection to a variant --------------------------- */

    const redL = selectionForVariant(VARIANTS[1]!);
    assert.equal(findVariant(VARIANTS, redL, 2)?.id, '2');

    // A partial selection resolves to nothing rather than to an arbitrary
    // match: adding "some red thing" to the cart is worse than not adding.
    assert.equal(findVariant(VARIANTS, {[COLOR]: 'o-red'}, 2), null);

    // A combination with no variant must not resolve either.
    assert.equal(
        findVariant(VARIANTS, {[COLOR]: 'o-blue', [SIZE]: 'o-L'}, 2),
        null,
        'blue/L does not exist and must not resolve to a neighbouring variant',
    );

    /* --- availability -------------------------------------------------- */

    // With blue chosen, only S remains reachable.
    const sizesForBlue = availableOptionIds(VARIANTS, {[COLOR]: 'o-blue'}, SIZE);
    assert.deepEqual([...sizesForBlue].sort(), ['o-S']);

    // With L chosen, only red remains reachable.
    const colorsForL = availableOptionIds(VARIANTS, {[SIZE]: 'o-L'}, COLOR);
    assert.deepEqual([...colorsForL].sort(), ['o-red']);

    // A group's own current choice never constrains itself, otherwise every
    // option but the selected one would render disabled.
    const colors = availableOptionIds(VARIANTS, {[COLOR]: 'o-red'}, COLOR);
    assert.deepEqual([...colors].sort(), ['o-blue', 'o-red']);

    /* --- repairing an impossible selection ----------------------------- */

    // Sitting on red/L and tapping blue: blue/L does not exist, so the size
    // must move to one blue actually has instead of leaving a dead selection.
    const repaired = selectOption(VARIANTS, redL, COLOR, 'o-blue', 2);
    const resolved = findVariant(VARIANTS, repaired, 2);
    assert.equal(resolved?.id, '3', 'tapping an impossible combination must snap to a real variant');

    // A possible change leaves the other group alone.
    const kept = selectOption(VARIANTS, selectionForVariant(VARIANTS[0]!), SIZE, 'o-L', 2);
    assert.equal(kept[COLOR], 'o-red');
    assert.equal(findVariant(VARIANTS, kept, 2)?.id, '2');

    /* --- initial selection --------------------------------------------- */

    // red/S is out of stock, so the page must not open on it: opening on a
    // disabled add-to-cart looks like the product cannot be bought at all.
    assert.equal(findVariant(VARIANTS, initialSelection(VARIANTS), 2)?.id, '2');
    assert.deepEqual(initialSelection([]), {});

    /* --- stock levels --------------------------------------------------- */

    assert.equal(stockState('IN_STOCK'), 'in-stock');
    assert.equal(stockState('LOW_STOCK'), 'low-stock');
    assert.equal(stockState('OUT_OF_STOCK'), 'out-of-stock');
    assert.equal(stockState(null), 'out-of-stock');

    // Channels configured to expose exact counts answer with a number as a
    // string. Treating that as unknown would mark the whole catalogue
    // unavailable.
    assert.equal(stockState('0'), 'out-of-stock');
    assert.equal(stockState('3'), 'low-stock');
    assert.equal(stockState('250'), 'in-stock');

    // An unrecognised label errs towards selling.
    assert.equal(stockState('BACKORDER'), 'in-stock');
}
