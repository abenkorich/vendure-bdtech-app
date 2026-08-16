/**
 * Locale definitions.
 *
 * Path-compatible with the web storefront's `src/i18n/routing.ts` so files
 * copied from it resolve `@/i18n/routing` unchanged. The `next-intl`
 * `defineRouting` call is gone: URL-prefix routing is a web concern, and the
 * app selects a locale from device settings or an explicit user preference.
 *
 * The three locales match the Vendure channel's `availableLanguageCodes`
 * (verified against api.dzduino.dz: en, ar, fr).
 */

export const locales = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
    en: 'English',
    fr: 'Français',
    ar: 'العربية',
};

/** Kept as an object for call-compatibility with the copied web modules. */
export const routing = {locales, defaultLocale} as const;

export function isLocale(value: string): value is Locale {
    return (locales as readonly string[]).includes(value);
}
