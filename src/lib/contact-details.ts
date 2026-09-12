/**
 * How a customer identifies themselves: one name, and an email or a mobile.
 *
 * Ported from the web storefront's `src/lib/contact-details.ts` and kept
 * diffable against it. Every rule here is an *interoperability* rule rather
 * than a preference — the two front-ends write to the same Vendure customer
 * table, so a name split one way on the phone and another on the web, or a
 * phone-only account whose synthetic email differs by a character, produces a
 * duplicate customer that support has to merge by hand.
 *
 * Vendure requires an `emailAddress` on a customer and has no notion of a
 * phone-only account. A customer who gives only a mobile therefore gets a
 * synthetic identifier — `213550999999@phone.guest.local` — which the backend
 * knows to hide and the two front-ends know never to show. That is what
 * `displayCustomerEmail` is for: it returns null rather than printing the
 * placeholder on a receipt.
 */

import {countryFromE164, DEFAULT_COUNTRY, isValidPhone, toE164} from '@/lib/phone-number';

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const GUEST_PHONE_EMAIL_DOMAIN = 'phone.guest.local';

export function isValidEmail(value: string): boolean {
    return EMAIL_REGEX.test(value.trim());
}

/**
 * One typed name into Vendure's two columns.
 *
 * A single word is stored in both, not as `('Amine', '-')`: the customer
 * record is shown as "first last" in the Admin and in emails, and a lone
 * hyphen there reads as broken data. The empty case keeps the storefront's
 * `'-'` sentinel because the backend already has rows written that way.
 */
export function splitFullName(fullName: string): {firstName: string; lastName: string} {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return {firstName: '-', lastName: '-'};
    if (parts.length === 1) return {firstName: parts[0]!, lastName: parts[0]!};
    return {firstName: parts[0]!, lastName: parts.slice(1).join(' ')};
}

/** The inverse, for pre-filling a form from a stored customer. */
export function joinFullName(firstName?: string | null, lastName?: string | null): string {
    const first = firstName?.trim() ?? '';
    const last = lastName?.trim() ?? '';
    if (!last || last === first || last === '-') return first;
    return `${first} ${last}`.trim();
}

/** The synthetic identifier for a customer who gave only a mobile. */
export function guestEmailFromPhone(e164: string): string {
    const digits = e164.replace(/\D/g, '');
    return `${digits}@${GUEST_PHONE_EMAIL_DOMAIN}`;
}

export function isGuestPhoneEmail(email?: string | null): boolean {
    return Boolean(email?.toLowerCase().endsWith(`@${GUEST_PHONE_EMAIL_DOMAIN}`));
}

/** The address to show a customer, or null when there is nothing real to show. */
export function displayCustomerEmail(email?: string | null): string | null {
    if (!email || isGuestPhoneEmail(email)) return null;
    return email;
}

/**
 * The `login` username for whatever someone typed in the sign-in field.
 *
 * An email goes as-is. A mobile is converted to the same identifier
 * registration wrote for it, so an account created with a phone and no email
 * is not a dead end — without this, that customer has no way back in. The
 * country is read from a leading `+`, and is Algeria otherwise, since a
 * number typed with no prefix on this store is an Algerian one.
 *
 * Exactly one candidate is sent, never a list of guesses: each attempt spends
 * a captcha token and turns a wrong password into a generic server error.
 */
export function normalizeLoginIdentifier(value: string): string {
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes('@')) return trimmed;

    const country = trimmed.startsWith('+') ? countryFromE164(trimmed) : DEFAULT_COUNTRY;
    if (!isValidPhone(country, trimmed)) return trimmed;
    return guestEmailFromPhone(toE164(country, trimmed));
}
