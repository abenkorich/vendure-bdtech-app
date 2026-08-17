import {readLocale} from '@/i18n/locale-state';

/**
 * The locale that number and date formatting should use.
 *
 * This used to read the *device* language, as a stopgap until the i18n layer
 * existed. That layer landed and this never followed, which left the app
 * speaking two languages at once: an English UI on an Arabic-locale device
 * rendered "1 product" and "Coming soon" next to prices in Arabic-Indic digits
 * (١٧٠ د.ج), because the strings came from the app's locale and the numbers
 * came from the OS.
 *
 * The user's in-app choice now wins. The device is consulted only to seed that
 * choice on first launch, which is `getLocale`'s own job, and as a fallback
 * when the i18n layer is not available (tests, prerender).
 */

const SUPPORTED = ['en', 'fr', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED)[number];

export function deviceLocale(): SupportedLocale {
    const selected = readLocale();
    if ((SUPPORTED as readonly string[]).includes(selected)) {
        return selected as SupportedLocale;
    }
    return 'en';
}
