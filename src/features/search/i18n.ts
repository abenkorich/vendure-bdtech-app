import {useCallback} from 'react';
import {formatMessage, type MessageValues} from '@/i18n/format-message';
import {deviceLocale} from '@/design/locale';
import en from '../../../messages/en.json';
import fr from '../../../messages/fr.json';
import ar from '../../../messages/ar.json';

/**
 * Local translation accessor for the search feature.
 *
 * The shared `useTranslations()` from the i18n workstream (see
 * `docs/CONTRACTS.md`) has not landed yet. Rather than hard-code English —
 * which would have to be hunted down at every call site later — this reads the
 * real catalogs with the real key paths, so swapping it for the shared hook is
 * a one-line import change per file and nothing else.
 */

const CATALOGS = {en, fr, ar} as const;

type Namespace = 'Search' | 'Filters' | 'Sort' | 'Product' | 'Common';

function lookup(locale: string, namespace: Namespace, key: string): string {
    const catalog = (CATALOGS as Record<string, Record<string, Record<string, unknown>>>)[locale]
        ?? CATALOGS.en;
    const value = catalog[namespace]?.[key];
    if (typeof value === 'string') return value;
    // Fall back to English rather than rendering the raw key: a missing French
    // string should degrade to a readable word, not to `Search.noResultsFor`.
    const fallback = (CATALOGS.en as Record<string, Record<string, unknown>>)[namespace]?.[key];
    return typeof fallback === 'string' ? fallback : key;
}

export function useTranslations(namespace: Namespace) {
    const locale = deviceLocale();

    return useCallback(
        (key: string, values?: MessageValues) =>
            formatMessage(lookup(locale, namespace, key), values ?? {}, locale),
        [locale, namespace],
    );
}

export type Translate = ReturnType<typeof useTranslations>;
