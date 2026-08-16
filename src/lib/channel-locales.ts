import {localeNames, routing, type Locale} from '@/i18n/routing';

export type ChannelLocales = {
    locales: Locale[];
    defaultLocale: Locale;
};

/** Normalize Vendure LanguageCode values (e.g. en_US → en) for storefront routing. */
export function normalizeLanguageCode(code: string): string {
    return code.trim().split(/[_-]/)[0]?.toLowerCase() ?? '';
}

/**
 * Intersect channel available languages with storefront-supported locales.
 * Falls back to all storefront locales when the channel list is empty/unavailable.
 */
export function resolveChannelLocales(
    availableLanguageCodes: readonly string[] | null | undefined,
    defaultLanguageCode?: string | null,
): ChannelLocales {
    const storefrontLocales = routing.locales as readonly Locale[];
    const channelCodes = new Set(
        (availableLanguageCodes ?? [])
            .map(normalizeLanguageCode)
            .filter(Boolean),
    );

    let locales =
        channelCodes.size > 0
            ? storefrontLocales.filter((locale) => channelCodes.has(locale))
            : [...storefrontLocales];

    if (locales.length === 0) {
        locales = [...storefrontLocales];
    }

    const preferred = normalizeLanguageCode(defaultLanguageCode ?? storefrontLocales[0]);
    const defaultLocale = locales.includes(preferred as Locale)
        ? (preferred as Locale)
        : locales[0];

    return {
        locales: [defaultLocale, ...locales.filter((locale) => locale !== defaultLocale)],
        defaultLocale,
    };
}

export function localeDisplayName(locale: string): string {
    return localeNames[locale as Locale] ?? locale.toUpperCase();
}
