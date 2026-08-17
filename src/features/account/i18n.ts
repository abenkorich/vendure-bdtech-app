import en from '../../../messages/en.json';
import fr from '../../../messages/fr.json';
import ar from '../../../messages/ar.json';
import {formatMessage, type MessageValues} from '@/i18n/format-message';
import {deviceLocale, type SupportedLocale} from '@/design/locale';
import {toIntlLocale} from '@/i18n/locale-utils';

/**
 * Message lookup for the account/auth/blog/tools areas.
 *
 * The i18n phase-2 `useTranslations` hook does not exist yet, and the interim
 * convention elsewhere in the app (`features/catalogue-strings.ts`) is to
 * hard-code the English literal beside its key path. That is fine for a dozen
 * strings; these four areas use ~250, and hard-coding them would mean Arabic
 * and French screens render English while the catalogs already hold the
 * translations.
 *
 * So this reads the real catalogs by key path and runs them through the same
 * ICU evaluator the rest of the app will use. Swapping to `useTranslations`
 * later is a one-line change in `useT` — every call site already passes a real
 * key path, and no new literal is introduced anywhere.
 *
 * Missing keys return the path itself, which is loud in the UI on purpose:
 * `messages-parity.test.ts` guards the catalogs, and a visible key path is a
 * bug report rather than a blank label.
 */

const CATALOGS: Record<SupportedLocale, unknown> = {en, fr, ar};

function lookup(catalog: unknown, path: string): string | undefined {
    let node: unknown = catalog;
    for (const segment of path.split('.')) {
        if (node === null || typeof node !== 'object') return undefined;
        node = (node as Record<string, unknown>)[segment];
    }
    return typeof node === 'string' ? node : undefined;
}

export type Translate = (key: string, values?: MessageValues) => string;

/** Resolve a full key path (`'Auth.signIn'`) in the active locale. */
export function translate(key: string, values?: MessageValues, locale = deviceLocale()): string {
    const message = lookup(CATALOGS[locale], key) ?? lookup(CATALOGS.en, key);
    if (message === undefined) return key;
    try {
        return formatMessage(message, values, toIntlLocale(locale));
    } catch {
        // A message using ICU syntax the evaluator does not implement must not
        // take a whole screen down; show the raw template instead.
        return message;
    }
}

/**
 * Namespaced translator, mirroring the phase-2 hook's shape so call sites do
 * not change when it lands: `const t = useT('Auth'); t('signIn')`.
 */
export function useT(namespace: string): Translate {
    return (key, values) => translate(`${namespace}.${key}`, values);
}

/** Active display locale. Device-derived until the i18n layer owns it. */
export function useActiveLocale(): SupportedLocale {
    return deviceLocale();
}
