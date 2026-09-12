import {
    countryFromE164,
    findCountry,
    formatNational,
    toE164,
    toNationalDigits,
    validatePhone,
} from '@/lib/phone-number';
import {
    guestEmailFromPhone,
    joinFullName,
    normalizeLoginIdentifier,
    splitFullName,
} from '@/lib/contact-details';
import {eq, done} from './harness';

/**
 * The contact rules the app shares with the web storefront.
 *
 * These are interoperability rules, not preferences: sign-up on the phone and
 * sign-up on the website write to one Vendure customer table, so a name split
 * differently, or a mobile-only account whose synthetic identifier differs by
 * a character, silently produces a duplicate customer that support has to
 * merge by hand. Every expectation below is the storefront's own behaviour —
 * if one of them starts failing, check `vendure-bdtech-storefront`'s
 * `src/lib/phone-number.ts` and `src/lib/contact-details.ts` before changing
 * the number here.
 */
export async function run(): Promise<void> {
    const dz = findCountry('DZ');
    const fr = findCountry('FR');

    /* --------------------------------------------- Algeria, strictly ---- */

    eq('a local number is grouped the way Algeria writes it', formatNational(dz, '0550123456'), '0550 12 34 56');
    eq('and stored in E.164', toE164(dz, '0550123456'), '+213550123456');
    eq('a pasted international number is the same number', toE164(dz, '+213550123456'), '+213550123456');
    eq('and is displayed back in the local form', formatNational(dz, '+213550123456'), '0550 12 34 56');
    eq('a longer paste cannot overflow the field', toNationalDigits(dz, '05501234567890'), '0550123456');

    eq('a mobile passes', validatePhone(dz, '0550123456'), null);
    eq('a short number does not', validatePhone(dz, '05501234'), 'format');
    eq('nor a landline prefix', validatePhone(dz, '0450123456'), 'format');
    eq('a repeated pair is not a real number', validatePhone(dz, '0550717171'), 'pattern');
    eq('nor is a run of zeros', validatePhone(dz, '0550000000'), 'pattern');
    eq('empty is reported as empty, not as malformed', validatePhone(dz, ''), 'required');

    /* ------------------------------------- everywhere else, loosely ----- */

    eq('another country groups by its own convention', formatNational(fr, '0612345678'), '06 12 34 56 78');
    eq('and drops its trunk digit in E.164', toE164(fr, '0612345678'), '+33612345678');
    eq('round-tripping restores the trunk digit', formatNational(fr, '+33612345678'), '06 12 34 56 78');
    eq('a plausible length is accepted', validatePhone(fr, '0612345678'), null);
    eq('a half-typed one is not', validatePhone(fr, '0612'), 'format');

    eq('a stored number knows its own country', countryFromE164('+33612345678').iso, 'FR');
    eq('the longest calling code wins, so +213 is not +21', countryFromE164('+213550123456').iso, 'DZ');
    eq('a number saved before the selector existed is Algerian', countryFromE164('0550123456').iso, 'DZ');

    /* ------------------------------------------------------- the name --- */

    const one = splitFullName('Amine');
    eq('one word fills both columns', `${one.firstName}|${one.lastName}`, 'Amine|Amine');
    const three = splitFullName('  Ali  Ben  Salah ');
    eq('the rest of the name is the surname', `${three.firstName}|${three.lastName}`, 'Ali|Ben Salah');
    eq('the storefront sentinel is not shown back', joinFullName('Amine', '-'), 'Amine');
    eq('a doubled name reads as one', joinFullName('Amine', 'Amine'), 'Amine');
    eq('a real pair joins', joinFullName('Ali', 'Ben Salah'), 'Ali Ben Salah');

    /* ------------------------------------------------- the identifier --- */

    eq(
        'a mobile-only account gets the identifier the website also builds',
        guestEmailFromPhone('+213550123456'),
        '213550123456@phone.guest.local',
    );
    eq('an email signs in as itself', normalizeLoginIdentifier(' a@b.co '), 'a@b.co');
    eq(
        'a mobile signs in as the account registration created for it',
        normalizeLoginIdentifier('0550 12 34 56'),
        '213550123456@phone.guest.local',
    );
    eq(
        'including one typed with its country code',
        normalizeLoginIdentifier('+33612345678'),
        '33612345678@phone.guest.local',
    );
    eq('anything else is passed through for the server to reject', normalizeLoginIdentifier('abc'), 'abc');

    done();
}
