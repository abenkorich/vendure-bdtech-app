/**
 * Money formatting — the single conversion point for Vendure prices.
 *
 * Vendure returns `Money` as an **integer in minor units** (centimes for DZD).
 * Rendering that value raw is the bug this module exists to prevent: it looks
 * like a plausible number, so it survives review, and every price on the screen
 * is 100x too large.
 *
 * Deliberately free of React Native imports so it can be unit-tested in Node
 * (`tests/price-format.test.ts`); `Price.tsx` is a thin renderer over this.
 */

import {toIntlLocale} from '@/i18n/locale-utils';

/**
 * How many minor units make one major unit, per currency.
 *
 * Almost everything is 2. The exceptions matter because dividing a zero-decimal
 * currency by 100 understates the price by 100x, which is the mirror image of
 * the bug above. This channel is DZD-only today, but the storefront's currency
 * is channel configuration and can change without touching this file.
 */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'XOF', 'XAF', 'XPF', 'RWF', 'UGX', 'VUV', 'GNF', 'KMF', 'PYG', 'DJF', 'BIF']);
const THREE_DECIMAL = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

export function minorUnitDigits(currencyCode: string): number {
    const code = currencyCode.toUpperCase();
    if (ZERO_DECIMAL.has(code)) return 0;
    if (THREE_DECIMAL.has(code)) return 3;
    return 2;
}

/** Convert an integer minor-unit amount to its major-unit value. */
export function toMajorUnits(minor: number, currencyCode: string): number {
    return minor / 10 ** minorUnitDigits(currencyCode);
}

export interface FormatPriceOptions {
    /** App locale (`en` | `fr` | `ar`). Mapped to a full BCP-47 tag. */
    locale?: string;
    /**
     * Drop the fraction when the amount is a whole major unit. Default true:
     * this catalogue prices in whole dinars and `2 400,00 DA` is noise on a
     * product card. An amount with real centimes still shows them.
     */
    hideZeroFraction?: boolean;
    /** Render the currency symbol at all. Default true. */
    showCurrency?: boolean;
}

/**
 * Format an integer minor-unit amount for display.
 *
 * @param minor Integer amount in minor units, as Vendure returns it.
 * @param currencyCode ISO 4217 code, e.g. `DZD`.
 */
export function formatPrice(
    minor: number,
    currencyCode: string,
    options: FormatPriceOptions = {},
): string {
    const {locale = 'en', hideZeroFraction = true, showCurrency = true} = options;

    if (!Number.isFinite(minor)) return '';

    const digits = minorUnitDigits(currencyCode);
    const major = toMajorUnits(minor, currencyCode);
    const isWhole = Number.isInteger(major);
    const fraction = hideZeroFraction && isWhole ? 0 : digits;

    const format: Intl.NumberFormatOptions = showCurrency
        ? {style: 'currency', currency: currencyCode.toUpperCase(), currencyDisplay: 'narrowSymbol'}
        : {style: 'decimal'};

    try {
        return new Intl.NumberFormat(toIntlLocale(locale), {
            ...format,
            // Force Latin digits. `ar-SA` defaults to Arabic-Indic numerals,
            // which are correct prose but wrong here: the catalogue's SKUs,
            // spec tables and prices are read as data and compared down a
            // column, and mixing numeral systems between screens is worse
            // than picking one. Arabic *layout* still flips; only the glyphs
            // stay Latin.
            numberingSystem: 'latn',
            minimumFractionDigits: fraction,
            maximumFractionDigits: fraction,
        }).format(major);
    } catch {
        // `narrowSymbol` is unsupported on some older Hermes/ICU builds, and an
        // unknown currency code throws outright. Neither should blank a price.
        try {
            return new Intl.NumberFormat(toIntlLocale(locale), {
                style: 'decimal',
                numberingSystem: 'latn',
                minimumFractionDigits: fraction,
                maximumFractionDigits: fraction,
            }).format(major) + (showCurrency ? ` ${currencyCode.toUpperCase()}` : '');
        } catch {
            return String(major);
        }
    }
}

/**
 * Discount percentage between a list price and the price actually charged.
 * Returns null when there is no saving, so callers can render nothing rather
 * than a `-0%` badge.
 */
export function discountPercent(listMinor: number, currentMinor: number): number | null {
    if (!Number.isFinite(listMinor) || !Number.isFinite(currentMinor)) return null;
    if (listMinor <= 0 || currentMinor >= listMinor) return null;
    return Math.round(((listMinor - currentMinor) / listMinor) * 100);
}
