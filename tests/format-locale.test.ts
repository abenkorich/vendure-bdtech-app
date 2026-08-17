import {check, done} from './harness';
import {deviceLocale} from '@/design/locale';

/**
 * Formatting must follow the *app's* language, not the device's.
 *
 * These are separate settings, and on an Arabic-locale simulator running the
 * app in English they disagreed: the UI read "Search", "190 results" and
 * "1 product" while every price rendered in Arabic-Indic digits (١٧٠ د.ج) and
 * the search header was Arabic. Strings came from the i18n layer, numbers from
 * `expo-localization`.
 *
 * `deviceLocale` is the single default behind `Price`, blog dates and the
 * search strings, so pinning it here covers all three.
 */

export async function run(): Promise<void> {
    const {initLocaleState, writeLocale} = await import('@/i18n/locale-state');
    initLocaleState('en' as never, () => 'en' as never);
    const stub = (locale: string) => writeLocale(locale as never);

    try {
        for (const locale of ['en', 'fr', 'ar'] as const) {
            stub(locale);
            check(
                `formatting follows the app's ${locale}, whatever the device says`,
                deviceLocale() === locale,
                `got ${deviceLocale()}`,
            );
        }

        // An unsupported in-app value must not be trusted blindly.
        stub('de');
        check(
            'an unsupported locale falls back instead of being passed through',
            (['en', 'fr', 'ar'] as readonly string[]).includes(deviceLocale()),
            `got ${deviceLocale()}`,
        );
    } finally {
        stub('en');
    }

    done();
}
