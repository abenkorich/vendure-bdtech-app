import {toIntlLocale} from '@/i18n/locale-utils';

type DateFormat = 'short' | 'long';

/**
 * Format a date string
 * @param dateString ISO date string. Nullish yields '' rather than the epoch,
 *   which `new Date(null)` would otherwise produce.
 * @param format 'short' (Jan 15, 2024) or 'long' (January 15, 2024)
 * @param locale App locale code (e.g. 'en', 'fr')
 */
export function formatDate(dateString: string | null | undefined, format: DateFormat = 'short', locale: string = 'en'): string {
    if (!dateString) return '';
    const options: Intl.DateTimeFormatOptions = format === 'long'
        ? { year: 'numeric', month: 'long', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric' };

    return new Date(dateString).toLocaleDateString(toIntlLocale(locale), options);
}
