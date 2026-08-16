import assert from 'node:assert/strict';
import {
    formatPrice,
    toMajorUnits,
    minorUnitDigits,
    discountPercent,
} from '@/design/format-price';

/**
 * Guards the one arithmetic mistake that would be invisible in review: Vendure
 * `Money` is an integer in **minor units**, so a price rendered without the
 * division is 100x too large and still looks like a real number.
 *
 * Asserts on digits rather than exact strings where ICU whitespace varies
 * (Intl uses NBSP/NNBSP as the group separator in fr, and RTL marks in ar), so
 * the test fails on a maths bug and not on a Node/ICU upgrade.
 */

/**
 * Digits only. ICU's group separator differs per locale (comma in en, NNBSP in
 * fr) and Arabic wraps the string in direction marks, so comparing raw output
 * would make this a test of the Node ICU build rather than of the arithmetic.
 */
function digits(value: string): string {
    return value.replace(/[^0-9]/g, '');
}

/**
 * True when the number carries a fractional part. A separator followed by
 * exactly one or two trailing digits is a decimal; a group separator is always
 * followed by three, so this distinguishes `2,500` from `2500.50` without
 * knowing which separator the locale chose.
 */
function hasFraction(value: string): boolean {
    const numeric = value.replace(/[^0-9.,]/g, '');
    return /[.,]\d{1,2}$/.test(numeric);
}

export async function run(): Promise<void> {
    /* ---- the core conversion ------------------------------------------- */

    // 240000 centimes is 2400 DZD, not 240000.
    assert.equal(toMajorUnits(240000, 'DZD'), 2400);
    assert.equal(digits(formatPrice(240000, 'DZD')), '2400');
    assert.ok(!formatPrice(240000, 'DZD').includes('240,000'), 'price rendered 100x too large');

    assert.equal(toMajorUnits(1, 'DZD'), 0.01);
    assert.equal(toMajorUnits(0, 'DZD'), 0);
    assert.equal(digits(formatPrice(0, 'DZD')), '0');
    assert.equal(digits(formatPrice(1, 'DZD')), '001', '1 centime must render as 0.01');

    /* ---- fractions ------------------------------------------------------ */

    // Whole dinars drop the fraction; real centimes keep it.
    assert.equal(digits(formatPrice(250000, 'DZD')), '2500');
    assert.ok(!hasFraction(formatPrice(250000, 'DZD')), 'whole dinars must not show .00');
    assert.equal(digits(formatPrice(250050, 'DZD')), '250050');
    assert.ok(hasFraction(formatPrice(250050, 'DZD')), 'real centimes must be shown');
    assert.equal(digits(formatPrice(250000, 'DZD', {hideZeroFraction: false})), '250000');

    /* ---- currency exponents --------------------------------------------- */

    assert.equal(minorUnitDigits('DZD'), 2);
    assert.equal(minorUnitDigits('dzd'), 2, 'currency code must be case-insensitive');
    assert.equal(minorUnitDigits('JPY'), 0);
    assert.equal(minorUnitDigits('KWD'), 3);
    // A zero-decimal currency divided by 100 would be 100x too *small*.
    assert.equal(toMajorUnits(2400, 'JPY'), 2400);
    assert.equal(toMajorUnits(2400000, 'KWD'), 2400);

    /* ---- locales --------------------------------------------------------- */

    for (const locale of ['en', 'fr', 'ar']) {
        const out = formatPrice(240000, 'DZD', {locale});
        assert.equal(digits(out), '2400', `${locale} formatted ${JSON.stringify(out)}`);
        // Arabic must render Latin digits: prices are read as tabular data.
        assert.ok(/2/.test(out), `${locale} lost its Latin digits: ${JSON.stringify(out)}`);
        assert.ok(out.length > 5, `${locale} dropped the currency symbol: ${out}`);
    }

    assert.equal(digits(formatPrice(240000, 'DZD', {showCurrency: false})), '2400');
    assert.ok(
        !/[A-Za-z\u0600-\u06ff]/.test(formatPrice(240000, 'DZD', {showCurrency: false})),
        'showCurrency:false still rendered a currency symbol',
    );

    /* ---- robustness ------------------------------------------------------ */

    assert.equal(formatPrice(Number.NaN, 'DZD'), '');
    assert.equal(formatPrice(Number.POSITIVE_INFINITY, 'DZD'), '');
    // An unknown code must degrade to a readable number, never throw or blank.
    assert.equal(digits(formatPrice(240000, 'ZZZ')), '2400');
    // Negative amounts occur on refunds and discount lines.
    assert.equal(digits(formatPrice(-240000, 'DZD')), '2400');
    assert.ok(/[-\u2212(]/.test(formatPrice(-240000, 'DZD')), 'negative amount lost its sign');

    /* ---- discount -------------------------------------------------------- */

    assert.equal(discountPercent(200000, 150000), 25);
    assert.equal(discountPercent(200000, 200000), null, 'no saving must render nothing');
    assert.equal(discountPercent(150000, 200000), null);
    assert.equal(discountPercent(0, 0), null);
    assert.equal(discountPercent(Number.NaN, 100), null);
}
