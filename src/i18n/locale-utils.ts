import {type Locale} from './routing';

const OG_LOCALE_MAP: Record<Locale, string> = {
    en: 'en_US',
    fr: 'fr_FR',
    ar: 'ar_SA',
};
const INTL_LOCALE_MAP: Record<Locale, string> = {
    en: 'en-US',
    fr: 'fr-FR',
    ar: 'ar-SA',
};

const RTL_LOCALES = new Set<Locale>(['ar']);

export function getTextDirection(locale: string): 'ltr' | 'rtl' {
    return RTL_LOCALES.has(locale as Locale) ? 'rtl' : 'ltr';
}

export function toOgLocale(locale: string): string {
    return OG_LOCALE_MAP[locale as Locale] || 'en_US';
}

export function toIntlLocale(locale: string): string {
    return INTL_LOCALE_MAP[locale as Locale] || 'en-US';
}
