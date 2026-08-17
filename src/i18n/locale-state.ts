import {type Locale} from '@/i18n/routing';

/**
 * The active locale, held apart from the React and React Native layers.
 *
 * `i18n/index.ts` imports `react-native` and `expo-localization`, so anything
 * that reads the current locale used to inherit that dependency. That is why
 * `design/locale.ts` read the *device* language instead of the app's: reaching
 * for the real value would have dragged React Native into the design system
 * and into every test that touches formatting.
 *
 * Keeping the current value in this leaf module lets both halves share one
 * source of truth. `i18n/index.ts` owns detection, persistence and the RTL
 * flip; this only remembers the answer.
 */

let current: Locale | undefined;
let fallback: () => Locale = () => 'en' as Locale;

/** Seeds the initial value; called by the i18n layer at startup. */
export function initLocaleState(initial: Locale, detect: () => Locale): void {
    current = initial;
    fallback = detect;
}

export function readLocale(): Locale {
    return current ?? fallback();
}

export function writeLocale(next: Locale): void {
    current = next;
}
