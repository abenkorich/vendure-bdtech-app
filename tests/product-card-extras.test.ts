import {stockLevelToDisplayQuantity} from '@/lib/product-card-extras';
import {toProductCardFragment} from '@/lib/vendure/product-card-from-detail';
import {eq, done} from './harness';

/**
 * A card that prints a stock figure must print a real one. Vendure returns
 * `stockLevel` either as a count or as a masking enum depending on the
 * channel, and turning `IN_STOCK` into a number would put an invented
 * quantity in front of a customer.
 */
export async function run(): Promise<void> {
    eq('a numeric level is the count', stockLevelToDisplayQuantity('42'), 42);
    eq('whitespace around it is tolerated', stockLevelToDisplayQuantity(' 7 '), 7);
    eq('zero is a real answer, not a missing one', stockLevelToDisplayQuantity('0'), 0);

    eq('OUT_OF_STOCK means none left', stockLevelToDisplayQuantity('OUT_OF_STOCK'), 0);
    eq('IN_STOCK hides the number, so there is none to show', stockLevelToDisplayQuantity('IN_STOCK'), null);
    eq('LOW_STOCK likewise', stockLevelToDisplayQuantity('LOW_STOCK'), null);
    eq('the enums are matched whatever their case', stockLevelToDisplayQuantity('in_stock'), null);

    eq('absent is unknown', stockLevelToDisplayQuantity(undefined), null);
    eq('null is unknown', stockLevelToDisplayQuantity(null), null);
    eq('empty is unknown', stockLevelToDisplayQuantity('   '), null);
    eq('nonsense is unknown', stockLevelToDisplayQuantity('plenty'), null);
    eq('a negative count is not a count', stockLevelToDisplayQuantity('-3'), null);

    /* ------------------------------------------------ the rail card path */

    /**
     * The home rails build their cards from the `products` query, which does
     * carry a variant, so those cards must arrive with both halves of the
     * meta bar filled in. This is the join that actually puts a number on
     * screen, and it is invisible to the type system: `readFragment` is an
     * identity at runtime, so the extra field rides along even though the
     * GraphQL fragment does not declare it.
     */
    const card = toProductCardFragment(
        {
            id: '1',
            name: 'Mini Smart Access Control',
            slug: 'mini-smart-access-control',
            assets: [],
            variants: [{id: '10', sku: 'DZD007334', priceWithTax: 1290000, stockLevel: '2'}],
        },
        'DZD',
    ) as unknown as {sku: string | null; stockQuantity: number | null};

    eq('a rail card carries its SKU', card.sku, 'DZD007334');
    eq('a rail card carries its stock count', card.stockQuantity, 2);

    const masked = toProductCardFragment(
        {
            id: '2',
            name: 'Masked stock',
            slug: 'masked',
            assets: [],
            variants: [{id: '20', sku: 'DZD000001', priceWithTax: 100, stockLevel: 'IN_STOCK'}],
        },
        'DZD',
    ) as unknown as {stockQuantity: number | null};

    eq('a channel that masks stock yields no number to print', masked.stockQuantity, null);

    done();
}
