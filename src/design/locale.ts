import {getLocales} from 'expo-localization';

/**
 * Best-guess display locale, used only as a *default* by design-system
 * primitives that format numbers or dates.
 *
 * The real source of truth is the i18n layer's `useLocale()`, which lands in
 * phase 2 and reflects the user's in-app choice rather than their device. Until
 * then a primitive that hard-coded `'en'` would render French device users a
 * comma-grouped price, and the fix later would be a hunt through every call
 * site. Centralising the guess here makes it one import to swap.
 */

const SUPPORTED = ['en', 'fr', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED)[number];

let cached: SupportedLocale | undefined;

export function deviceLocale(): SupportedLocale {
    if (cached) return cached;
    try {
        for (const {languageCode} of getLocales()) {
            const code = languageCode?.toLowerCase();
            if (code && (SUPPORTED as readonly string[]).includes(code)) {
                cached = code as SupportedLocale;
                return cached;
            }
        }
    } catch {
        // getLocales throws in a bare Node context (tests, prerender).
    }
    cached = 'en';
    return cached;
}
