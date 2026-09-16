import assert from 'node:assert/strict';
import {cardPriceDisplay, hasStruckPrice} from '@/design/card-price';
import {
    nextSaleTimingChange,
    reachedTier,
    saleTiming,
    summarizeVariantDiscounts,
    withVariantOverlay,
    type QuantityDiscountLike,
    type VariantDiscountLike,
} from '@/lib/product-discounts';
import {createBatchLoader} from '@/lib/batch-loader';

/**
 * Catalogue sale prices: what a card shows, the rail summary that must match
 * the server's search summary, the product page's tier and timing rules, and
 * the batching behind member prices. Amounts are integer minor units, with tax.
 */

function discount(
    productDiscountId: string,
    priceWithTax: number,
    originalPriceWithTax: number,
    percentOff: number,
    extra: Partial<VariantDiscountLike> = {},
): VariantDiscountLike {
    return {
        productDiscountId,
        name: `Sale ${productDiscountId}`,
        priceWithTax,
        originalPriceWithTax,
        percentOff,
        endsAt: null,
        unitsRemaining: null,
        maxQuantityPerOrder: null,
        membersOnly: false,
        ...extra,
    };
}

function tier(
    productDiscountId: string,
    minQuantity: number,
    priceWithTax: number,
    percentOff: number,
    extra: Partial<QuantityDiscountLike> = {},
): QuantityDiscountLike {
    return {
        productDiscountId,
        name: `Tier ${productDiscountId}`,
        minQuantity,
        priceWithTax,
        percentOff,
        endsAt: null,
        membersOnly: false,
        ...extra,
    };
}

export async function run(): Promise<void> {
    // --- card price ----------------------------------------------------------
    const single = {priceWithTax: {__typename: 'SinglePrice' as const, value: 480000}};
    assert.deepEqual(cardPriceDisplay(single), {
        value: 480000,
        compareAt: null,
        isRange: false,
        percentOff: null,
        upTo: false,
        membersOnly: false,
        quantityDiscount: null,
    });
    assert.equal(hasStruckPrice(single), false);

    const onSale = cardPriceDisplay({
        priceWithTax: {value: 100000},
        discount: {
            fromPriceWithTax: 80000,
            fromOriginalPriceWithTax: 100000,
            maxPercentOff: 20,
            membersOnly: false,
            quantityDiscount: null,
        },
    });
    assert.equal(onSale.value, 80000, 'the card shows the sale price');
    assert.equal(onSale.compareAt, 100000, 'struck at that same variant\'s real price');
    assert.equal(onSale.percentOff, 20);
    assert.equal(onSale.upTo, false, 'the priced variant has the whole saving');

    const range = cardPriceDisplay({
        priceWithTax: {min: 50000, max: 120000},
        discount: {
            fromPriceWithTax: 45000,
            fromOriginalPriceWithTax: 50000,
            maxPercentOff: 25,
            membersOnly: true,
            quantityDiscount: null,
        },
    });
    assert.equal(range.isRange, true);
    assert.equal(range.value, 45000);
    assert.equal(range.compareAt, 50000);
    assert.equal(range.upTo, true, 'a 10% "from" price under a 25% badge must say "up to"');
    assert.equal(range.membersOnly, true);

    const cheapestNotOnSale = cardPriceDisplay({
        priceWithTax: {min: 50000, max: 120000},
        discount: {
            fromPriceWithTax: 50000,
            fromOriginalPriceWithTax: 50000,
            maxPercentOff: 30,
            membersOnly: false,
        },
    });
    assert.equal(cheapestNotOnSale.compareAt, null, 'nothing is struck when the priced variant is not on sale');
    assert.equal(cheapestNotOnSale.percentOff, 30);
    assert.equal(cheapestNotOnSale.upTo, true);

    const tierOnly = cardPriceDisplay({
        priceWithTax: {value: 100000},
        discount: {
            fromPriceWithTax: 100000,
            fromOriginalPriceWithTax: 100000,
            maxPercentOff: 0,
            membersOnly: false,
            quantityDiscount: {minQuantity: 3, percentOff: 10},
        },
    });
    assert.equal(tierOnly.compareAt, null, 'a quantity tier is a hint, never a struck price');
    assert.equal(tierOnly.percentOff, null);
    assert.deepEqual(tierOnly.quantityDiscount, {minQuantity: 3, percentOff: 10});
    assert.equal(tierOnly.value, 100000);

    // --- rail summary mirrors the server's --------------------------------
    assert.equal(summarizeVariantDiscounts([{priceWithTax: 100000}]), null);

    const summary = summarizeVariantDiscounts([
        {
            priceWithTax: 100000,
            discount: discount('d1', 80000, 100000, 20, {endsAt: '2026-09-20T00:00:00.000Z'}),
        },
        {priceWithTax: 90000},
        {
            priceWithTax: 150000,
            discount: discount('d2', 135000, 150000, 10, {endsAt: '2026-09-18T00:00:00.000Z'}),
        },
    ]);
    assert.deepEqual(summary, {
        productDiscountId: 'd1',
        name: 'Sale d1',
        fromPriceWithTax: 80000,
        fromOriginalPriceWithTax: 100000,
        maxPercentOff: 20,
        endsAt: '2026-09-18T00:00:00.000Z',
        discountedVariantCount: 2,
        membersOnly: false,
        quantityDiscount: null,
    });

    const tie = summarizeVariantDiscounts([
        {priceWithTax: 100000, discount: discount('big', 80000, 100000, 20)},
        {priceWithTax: 90000, discount: discount('small', 80000, 90000, 11)},
    ]);
    assert.equal(tie?.fromOriginalPriceWithTax, 90000, 'on equal sale prices the lower real price is struck');
    assert.equal(tie?.maxPercentOff, 20);
    assert.equal(tie?.name, 'Sale big', 'the headline is the biggest saving');

    const tiersOnly = summarizeVariantDiscounts([
        {
            priceWithTax: 100000,
            quantityDiscounts: [
                tier('t5', 5, 85000, 15),
                tier('t3', 3, 90000, 10, {membersOnly: true}),
            ],
        },
    ]);
    assert.equal(tiersOnly?.maxPercentOff, 0);
    assert.equal(tiersOnly?.fromPriceWithTax, 100000);
    assert.deepEqual(tiersOnly?.quantityDiscount, {minQuantity: 3, percentOff: 10});
    assert.equal(tiersOnly?.name, 'Tier t3', 'without a sale the lowest tier is the headline');
    assert.equal(tiersOnly?.membersOnly, true);

    // --- member overlay on variants ---------------------------------------
    const memberSale = discount('m', 70000, 100000, 30, {membersOnly: true});
    const variants: {
        id: string;
        discount: VariantDiscountLike | null;
        quantityDiscounts: QuantityDiscountLike[];
    }[] = [
        {id: '1', discount: null, quantityDiscounts: []},
        {id: '2', discount: discount('d1', 90000, 100000, 10), quantityDiscounts: []},
    ];
    const overlaid = withVariantOverlay(variants, {
        variants: [{productVariantId: '1', discount: memberSale, quantityDiscounts: [tier('t', 3, 60000, 40)]}],
    });
    assert.equal(overlaid[0]!.discount, memberSale);
    assert.equal(overlaid[0]!.quantityDiscounts.length, 1);
    assert.equal(overlaid[1], variants[1], 'a variant the overlay does not mention is kept as it was');
    assert.equal(withVariantOverlay(variants, null), variants);
    assert.equal(withVariantOverlay(variants, {variants: []}), variants);

    // --- tier reached at a quantity ----------------------------------------
    const tiered = {
        priceWithTax: 100000,
        discount: discount('s', 90000, 100000, 10),
        quantityDiscounts: [tier('t3', 3, 85000, 15), tier('t10', 10, 95000, 5)],
    };
    assert.equal(reachedTier(tiered, 1), null);
    assert.equal(reachedTier(tiered, 3)?.productDiscountId, 't3');
    assert.equal(
        reachedTier(tiered, 10)?.productDiscountId,
        't3',
        'a tier worse than one already reached is not "reached"',
    );
    const tiersNoSale = {
        priceWithTax: 100000,
        discount: null,
        quantityDiscounts: [tier('t3', 3, 90000, 10), tier('t10', 10, 80000, 20)],
    };
    assert.equal(reachedTier(tiersNoSale, 10)?.productDiscountId, 't10');
    assert.equal(reachedTier(tiersNoSale, 2), null);

    // --- sale timing -------------------------------------------------------
    const now = Date.parse('2026-09-15T12:00:00.000Z');
    const at = (ms: number) => new Date(now + ms).toISOString();
    const HOUR = 60 * 60 * 1000;

    assert.equal(saleTiming(null, now), null);
    assert.equal(saleTiming('not a date', now), null);
    assert.deepEqual(saleTiming(at(-60_000), now), {kind: 'ended'});
    assert.deepEqual(saleTiming(at(72 * HOUR + 60_000), now), {kind: 'date', endsAt: at(72 * HOUR + 60_000)});
    assert.deepEqual(saleTiming(at(72 * HOUR), now), {kind: 'countdown', days: 3, hours: 0, minutes: 0});
    assert.deepEqual(
        saleTiming(at(2 * 24 * HOUR + 5 * HOUR + 30_000), now),
        {kind: 'countdown', days: 2, hours: 5, minutes: 1},
        'a part minute counts as a minute',
    );
    assert.deepEqual(
        saleTiming(at(40_000), now),
        {kind: 'countdown', days: 0, hours: 0, minutes: 1},
        'never "0m" while the sale is still on',
    );

    assert.equal(nextSaleTimingChange(at(125_000), now), 5_001, 'ticks when the displayed minute changes');
    assert.equal(nextSaleTimingChange(at(30_000), now), 30_001, 'and when the sale ends');
    assert.equal(nextSaleTimingChange(at(120_000), now), 60_000, 'timers stay within a minute');
    assert.equal(nextSaleTimingChange(at(72 * HOUR + 10 * 60_000), now), 60_000);
    assert.equal(nextSaleTimingChange(at(-1), now), null);
    assert.equal(nextSaleTimingChange(null, now), null);

    // --- batch loader ----------------------------------------------------------
    const calls: string[][] = [];
    const loader = createBatchLoader<string>(
        async keys => {
            calls.push([...keys]);
            return new Map(keys.filter(key => key !== 'missing').map(key => [key, `value:${key}`]));
        },
        {maxBatchSize: 2},
    );
    const loaded = await Promise.all([
        loader.load('a'),
        loader.load('b'),
        loader.load('a'),
        loader.load('c'),
        loader.load('missing'),
    ]);
    assert.deepEqual(loaded, ['value:a', 'value:b', 'value:a', 'value:c', null]);
    assert.deepEqual(
        calls,
        [
            ['a', 'b'],
            ['c', 'missing'],
        ],
        'loads in the same moment share requests, split at the batch size, each key once',
    );
    await loader.load('d');
    assert.equal(calls.length, 3, 'a later load starts a new batch');

    const failing = createBatchLoader<string>(
        async () => {
            throw new Error('offline');
        },
        {maxBatchSize: 10},
    );
    await assert.rejects(failing.load('x'), /offline/, 'a failed request rejects every load in it');
}
