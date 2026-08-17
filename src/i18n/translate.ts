import {formatMessage, type MessageValues} from '@/i18n/format-message';
import {defaultLocale, type Locale} from '@/i18n/routing';

import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import ar from '../../messages/ar.json';

/**
 * Catalog lookup and ICU formatting, with no React Native dependency.
 *
 * Split from `i18n/index.ts` so it can be bundled for Node: that module
 * imports `I18nManager` and expo-localization, and anything reaching
 * react-native fails to bundle in the test harness with an error that names
 * react-native rather than the real cause.
 */

const CATALOGS: Record<Locale, Record<string, unknown>> = {en, fr, ar};

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
 * A missing key falls back to English and then to the key path itself.
 * Rendering the raw path is deliberately ugly: it is visible in a screenshot,
 * where a silent empty string would not be.
 */
export function translate(
    locale: Locale,
    namespace: string,
    key: string,
    values?: MessageValues,
): string {
    const path = namespace ? `${namespace}.${key}` : key;
    const message = lookup(CATALOGS[locale] ?? CATALOGS[defaultLocale], path) ?? lookup(CATALOGS.en, path);

    if (message === undefined) return path;

    try {
        return formatMessage(message, values, locale);
    } catch {
        // A malformed message must not take down the screen rendering it.
        return message;
    }
}

export type {MessageValues};
