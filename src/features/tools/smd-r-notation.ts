import {formatResistance} from '@/lib/tools/resistor-color-code';

/**
 * `R`-notation SMD markings: `4R7` = 4.7 Ω, `R47` = 0.47 Ω, `47R` = 47 Ω.
 *
 * Sub-10 Ω parts cannot be expressed by a digit-multiplier code (a 3-digit code
 * bottoms out at 10 Ω), so the letter R stands in for the decimal point. The
 * ported engine's `decodeSmdCode` is numeric-only and rejects these, and
 * `src/lib/tools/**` is a copy kept diffable against the web storefront
 * (AGENTS.md rule 1), so the handling lives here instead of being patched into
 * the copy. The screen tries this first and falls back to the engine.
 */
export interface RDecimalMatch {
    ohms: number;
    formatted: string;
}

const R_NOTATION = /^(\d*)R(\d*)$/;

/** Returns ohms, or null when the code is not R-notation. */
export function decodeRDecimal(code: string): number | null {
    const match = R_NOTATION.exec(code.trim().toUpperCase());
    if (!match) return null;

    const [, whole, fraction] = match;
    if (!whole && !fraction) return null;

    const ohms = Number.parseFloat(`${whole || '0'}.${fraction || '0'}`);
    return Number.isFinite(ohms) && ohms > 0 ? ohms : null;
}

export function decodeRDecimalMatch(code: string): RDecimalMatch | null {
    const ohms = decodeRDecimal(code);
    return ohms === null ? null : {ohms, formatted: formatResistance(ohms)};
}

/** The R-notation marking for a sub-10 Ω value, or null when it does not apply. */
export function encodeRDecimal(ohms: number): string | null {
    if (!Number.isFinite(ohms) || ohms <= 0 || ohms >= 100) return null;

    const rounded = Number.parseFloat(ohms.toPrecision(3));
    const [whole, fraction = ''] = String(rounded).split('.');

    if (rounded < 1) return `R${fraction.padEnd(2, '0').slice(0, 2)}`;
    if (!fraction) return `${whole}R`;
    return `${whole}R${fraction.slice(0, 2)}`;
}
