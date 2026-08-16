import {useCallback, useEffect, useMemo, useState} from 'react';
import {I18nManager} from 'react-native';
import {getLocales} from 'expo-localization';
import {formatMessage, type MessageValues} from '@/i18n/format-message';
import {defaultLocale, isLocale, type Locale} from '@/i18n/routing';
import {prefsStorage} from '@/lib/storage/mmkv';

import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import ar from '../../messages/ar.json';

/**
 * Translation runtime.
 *
 * All three catalogs are bundled. That is ~400 KB of JSON, which is a real but
 * acceptable cost: the alternative is a network fetch on the very first screen,
 * and a store that cannot render its own navigation while offline is worse than
 * a slightly larger binary.
 *
 * ICU formatting is handled by `format-message.ts`, copied from the web
 * storefront, so a plural renders identically on both platforms.
 */

const CATALOGS: Record<Locale, Record<string, unknown>> = {en, fr, ar};

const LOCALE_KEY = 'app_locale';

const RTL_LOCALES = new Set<Locale>(['ar']);

export function isRtlLocale(locale: Locale): boolean {
    return RTL_LOCALES.has(locale);
}

/** Device locale, narrowed to one we actually ship. */
function detectLocale(): Locale {
    for (const {languageCode} of getLocales()) {
        const code = languageCode?.toLowerCase();
        if (code && isLocale(code)) return code;
    }
    return defaultLocale;
}

export function getStoredLocale(): Locale | null {
    const stored = prefsStorage().getString(LOCALE_KEY);
    return stored && isLocale(stored) ? stored : null;
}

export function getInitialLocale(): Locale {
    return getStoredLocale() ?? detectLocale();
}

/* -------------------------------------------------------------------------- */
/* Lookup                                                                     */
/* -------------------------------------------------------------------------- */

function lookup(catalog: Record<string, unknown>, path: string): string | undefined {
    let node: unknown = catalog;
    for (const segment of path.split('.')) {
        if (node === null || typeof node !== 'object') return undefined;
        node = (node as Record<string, unknown>)[segment];
    }
    return typeof node === 'string' ? node : undefined;
}

/**
 * Resolve a key to a formatted string.
 *
 * A missing key falls back to the English catalog and then to the key path
 * itself. Rendering the raw path is deliberately ugly: it is visible in a
 * screenshot, where a silent empty string would not be.
 */
export function translate(
    locale: Locale,
    namespace: string,
    key: string,
    values?: MessageValues,
): string {
    const path = namespace ? `${namespace}.${key}` : key;
    const message = lookup(CATALOGS[locale], path) ?? lookup(CATALOGS.en, path);

    if (message === undefined) {
        if (__DEV__) console.warn(`[i18n] missing key: ${path}`);
        return path;
    }

    try {
        return formatMessage(message, values, locale);
    } catch (error) {
        // A malformed message must not take down the screen that renders it.
        if (__DEV__) console.warn(`[i18n] bad message at ${path}:`, error);
        return message;
    }
}

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

type Listener = (locale: Locale) => void;
const listeners = new Set<Listener>();

let currentLocale: Locale = getInitialLocale();

export function getLocale(): Locale {
    return currentLocale;
}

/**
 * Change the app language.
 *
 * Returns whether a restart is required. Switching *into* or *out of* Arabic
 * flips `I18nManager`, and that only takes effect after the JS bundle reloads:
 * calling `forceRTL` alone leaves the UI in the previous direction, which looks
 * exactly like the setting having done nothing. Callers must surface this
 * rather than swallowing it.
 */
export function setLocale(next: Locale): {requiresRestart: boolean} {
    const wasRtl = isRtlLocale(currentLocale);
    const willBeRtl = isRtlLocale(next);

    currentLocale = next;
    prefsStorage().set(LOCALE_KEY, next);

    for (const listener of listeners) listener(next);

    if (wasRtl !== willBeRtl) {
        I18nManager.allowRTL(willBeRtl);
        I18nManager.forceRTL(willBeRtl);
        return {requiresRestart: true};
    }

    return {requiresRestart: false};
}

export function useLocale(): {
    locale: Locale;
    setLocale: (next: Locale) => {requiresRestart: boolean};
    isRTL: boolean;
} {
    const [locale, setLocaleState] = useState<Locale>(currentLocale);

    useEffect(() => {
        const listener: Listener = next => setLocaleState(next);
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    return {
        locale,
        setLocale,
        isRTL: isRtlLocale(locale),
    };
}

/**
 * Scoped translator, mirroring next-intl's API so the message keys copied from
 * the web storefront read the same way here.
 *
 *   const t = useTranslations('Product');
 *   t('addToCart')
 *   t('reviewCount', {count: 3})
 */
export function useTranslations(namespace: string): (key: string, values?: MessageValues) => string {
    const {locale} = useLocale();

    return useCallback(
        (key: string, values?: MessageValues) => translate(locale, namespace, key, values),
        [locale, namespace],
    );
}

/** Locale-aware number/date formatting, matching the catalogs' conventions. */
export function useFormatters() {
    const {locale} = useLocale();

    return useMemo(() => {
        const intlLocale = locale === 'ar' ? 'ar-DZ' : locale === 'fr' ? 'fr-DZ' : 'en-US';
        return {
            number: new Intl.NumberFormat(intlLocale),
            date: new Intl.DateTimeFormat(intlLocale, {dateStyle: 'medium'}),
            dateTime: new Intl.DateTimeFormat(intlLocale, {
                dateStyle: 'medium',
                timeStyle: 'short',
            }),
        };
    }, [locale]);
}
