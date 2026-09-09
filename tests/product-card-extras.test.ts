import {stockLevelToDisplayQuantity} from '@/lib/product-card-extras';
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

    done();
}
