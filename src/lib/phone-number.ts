/**
 * Mobile numbers, entered as a country code plus a national number.
 *
 * Ported from the web storefront's `src/lib/phone-number.ts` and kept
 * diffable against it: the Algerian rules below — the `0[567]` prefix, the
 * junk-pattern check on the last six digits, the `+213…` E.164 form — are
 * byte-for-byte the storefront's, because a number typed on the phone and a
 * number typed on the website have to produce the same `User.identifier` or
 * the same customer ends up with two accounts.
 *
 * What is new here is the country dimension. The store sells to a diaspora
 * that orders for family at home, and a field hardcoded to +213 makes those
 * customers unreachable. Only Algeria is validated strictly, though: its
 * numbering plan is the one that has been measured against real orders, and
 * inventing a plausible-looking rule for fourteen other countries would
 * reject valid numbers with great confidence. Everywhere else accepts any
 * 6–14 digit national number and formats it for readability only.
 */

export const DZ_CALLING_CODE = '213';

/**
 * Loosest rule that still catches a mistyped number anywhere. The upper bound
 * is each country's own grouping (see `capacity`); this is only the floor.
 */
const MIN_NATIONAL_DIGITS = 6;

export interface CallingCountry {
    /** ISO 3166-1 alpha-2, and the value the selector round-trips. */
    iso: string;
    /** Calling code, without the plus. */
    calling: string;
    /** Regional-indicator pair, so the list needs no image assets. */
    flag: string;
    /** English name; the selector shows it beside the flag. */
    name: string;
    /**
     * The digit this country writes in front of a national number and drops
     * in the international form. Absent where there is none (Spain, the Gulf
     * states), so those numbers are never shown with a phantom zero.
     */
    trunk?: '0';
    /** Display grouping of the national number, trunk digit included. */
    groups: readonly number[];
    /** Placeholder, in the form the country's own customers write it. */
    example: string;
}

/**
 * Algeria first, then where this store's customers actually order from.
 * Ordered by expected use rather than alphabetically: the picker searches
 * past eight entries, so the top of the list is the part that has to be right.
 */
export const CALLING_COUNTRIES: readonly CallingCountry[] = [
    {iso: 'DZ', calling: '213', flag: '🇩🇿', name: 'Algeria', trunk: '0', groups: [4, 2, 2, 2], example: '0550 00 00 00'},
    {iso: 'FR', calling: '33', flag: '🇫🇷', name: 'France', trunk: '0', groups: [2, 2, 2, 2, 2], example: '06 12 34 56 78'},
    {iso: 'TN', calling: '216', flag: '🇹🇳', name: 'Tunisia', groups: [2, 3, 3], example: '20 123 456'},
    {iso: 'MA', calling: '212', flag: '🇲🇦', name: 'Morocco', trunk: '0', groups: [2, 2, 2, 2, 2], example: '06 12 34 56 78'},
    {iso: 'LY', calling: '218', flag: '🇱🇾', name: 'Libya', trunk: '0', groups: [3, 3, 4], example: '091 234 5678'},
    {iso: 'ES', calling: '34', flag: '🇪🇸', name: 'Spain', groups: [3, 3, 3], example: '612 345 678'},
    {iso: 'IT', calling: '39', flag: '🇮🇹', name: 'Italy', groups: [3, 3, 4], example: '312 345 6789'},
    {iso: 'BE', calling: '32', flag: '🇧🇪', name: 'Belgium', trunk: '0', groups: [4, 2, 2, 2], example: '0470 12 34 56'},
    {iso: 'DE', calling: '49', flag: '🇩🇪', name: 'Germany', trunk: '0', groups: [4, 3, 4], example: '0151 234 5678'},
    {iso: 'GB', calling: '44', flag: '🇬🇧', name: 'United Kingdom', trunk: '0', groups: [5, 6], example: '07123 456789'},
    {iso: 'CH', calling: '41', flag: '🇨🇭', name: 'Switzerland', trunk: '0', groups: [3, 3, 2, 2], example: '079 123 45 67'},
    {iso: 'CA', calling: '1', flag: '🇨🇦', name: 'Canada', groups: [3, 3, 4], example: '514 123 4567'},
    {iso: 'TR', calling: '90', flag: '🇹🇷', name: 'Türkiye', trunk: '0', groups: [4, 3, 4], example: '0532 123 4567'},
    {iso: 'AE', calling: '971', flag: '🇦🇪', name: 'United Arab Emirates', trunk: '0', groups: [3, 3, 4], example: '050 123 4567'},
    {iso: 'SA', calling: '966', flag: '🇸🇦', name: 'Saudi Arabia', trunk: '0', groups: [4, 3, 4], example: '0501 234 567'},
];

export const DEFAULT_COUNTRY: CallingCountry = CALLING_COUNTRIES[0]!;

export function digitsOnly(value: string): string {
    return value.replace(/\D/g, '');
}

export function findCountry(iso: string | undefined | null): CallingCountry {
    return CALLING_COUNTRIES.find(country => country.iso === iso) ?? DEFAULT_COUNTRY;
}

/**
 * The country a stored number belongs to, by longest matching calling code —
 * `+2135…` is Algeria, not `+21` — falling back to Algeria for anything that
 * was saved before this field had a selector.
 */
export function countryFromE164(value: string | null | undefined): CallingCountry {
    const digits = digitsOnly(value ?? '');
    if (!digits) return DEFAULT_COUNTRY;
    const matches = CALLING_COUNTRIES.filter(country => digits.startsWith(country.calling));
    return (
        matches.sort((a, b) => b.calling.length - a.calling.length)[0] ?? DEFAULT_COUNTRY
    );
}

/** How many national digits the country's grouping holds, trunk included. */
function capacity(country: CallingCountry): number {
    return country.groups.reduce((total, size) => total + size, 0);
}

/**
 * The national number as the country writes it: trunk digit included where
 * there is one, calling code removed, and capped at the country's length so a
 * paste of a full international number cannot overflow the field.
 */
export function toNationalDigits(country: CallingCountry, value: string): string {
    let digits = digitsOnly(value);
    if (digits.startsWith(country.calling)) {
        digits = digits.slice(country.calling.length);
    }
    if (country.trunk) {
        // A significant number pasted without its trunk digit still belongs to
        // the same subscriber, so put the digit back rather than reject it.
        if (digits && !digits.startsWith(country.trunk)) digits = `${country.trunk}${digits}`;
    } else {
        digits = digits.replace(/^0+/, '');
    }
    return digits.slice(0, capacity(country));
}

/** The national number, spaced by the country's own grouping. */
export function formatNational(country: CallingCountry, value: string): string {
    const digits = toNationalDigits(country, value);
    if (!digits) return '';

    const parts: string[] = [];
    let index = 0;
    for (const size of country.groups) {
        if (index >= digits.length) break;
        parts.push(digits.slice(index, index + size));
        index += size;
    }
    return parts.join(' ');
}

/** `+213550000000`. Empty string for an empty input. */
export function toE164(country: CallingCountry, value: string): string {
    const national = toNationalDigits(country, value);
    if (!national) return '';
    const significant =
        country.trunk && national.startsWith(country.trunk) ? national.slice(1) : national;
    if (!significant) return '';
    return `+${country.calling}${significant}`;
}

export type PhoneError = 'required' | 'format' | 'pattern';

/**
 * Numbers that pass the prefix test but cannot be real: six zeros, six of the
 * same digit, or a two-digit pair repeated three times. Measured on the
 * storefront against orders that never reached a customer.
 */
function lastSixAreInvalid(local10: string): boolean {
    const last6 = local10.slice(-6);
    if (/^0{6}$/.test(last6)) return true;
    if (/^(\d)\1{5}$/.test(last6)) return true;
    if (/^(\d{2})\1\1$/.test(last6)) return true;
    return false;
}

/** Algeria's own rule, unchanged from the storefront. */
export function validateDzPhone(value: string): PhoneError | null {
    const trimmed = value.trim();
    if (!trimmed) return 'required';
    const local = toNationalDigits(DEFAULT_COUNTRY, trimmed);
    if (!/^0[567]\d{8}$/.test(local)) return 'format';
    if (lastSixAreInvalid(local)) return 'pattern';
    return null;
}

export function validatePhone(country: CallingCountry, value: string): PhoneError | null {
    if (country.iso === 'DZ') return validateDzPhone(value);

    const trimmed = value.trim();
    if (!trimmed) return 'required';
    const national = toNationalDigits(country, trimmed);
    const significant = country.trunk ? national.replace(/^0/, '') : national;
    // Deliberately loose. Mobile lengths vary within a country (Germany's run
    // 10 to 11 digits, Italy's 9 to 10) and this app is not the place to
    // encode fifteen numbering plans it cannot verify; the field's own cap
    // handles the upper bound, so this only catches a half-typed number.
    if (significant.length < MIN_NATIONAL_DIGITS) return 'format';
    return null;
}

export interface PhoneMessages {
    required: string;
    format: string;
    pattern: string;
}

/**
 * The message for a phone field, or `true` when it is fine. `optional` makes
 * an empty field acceptable while still rejecting a half-typed one, which is
 * what "an email or a mobile" needs.
 */
export function phoneFieldValidate(
    country: CallingCountry,
    value: string | undefined,
    messages: PhoneMessages,
    optional = false,
): true | string {
    const error = validatePhone(country, value ?? '');
    if (!error) return true;
    if (optional && error === 'required') return true;
    if (error === 'required') return messages.required;
    if (error === 'format') return messages.format;
    return messages.pattern;
}

export function isValidPhone(country: CallingCountry, value: string): boolean {
    return validatePhone(country, value) === null;
}
