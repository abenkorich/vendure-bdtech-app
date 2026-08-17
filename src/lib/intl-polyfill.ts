/**
 * Intl polyfills for Hermes.
 *
 * Hermes ships a partial `Intl`: `NumberFormat` and `DateTimeFormat` are
 * present, but **`Intl.PluralRules` is not**. Our ICU message formatter
 * constructs one for any `{count, plural, ...}` message, so every screen that
 * renders a pluralised string (a result count, an item count, a review count)
 * crashed with "undefined cannot be used as a constructor".
 *
 * That failure is invisible to `tsc` and to the bundler, and it does not
 * reproduce on a JSC build or in a browser. It was found by opening search
 * with a query and watching the screen die.
 *
 * Order matters: `getcanonicallocales` underpins `locale`, which underpins
 * `pluralrules`. Each `should-polyfill` check returns false on an engine that
 * already implements the API, so this is a no-op where it is not needed.
 */

import {shouldPolyfill as shouldPolyfillCanonical} from '@formatjs/intl-getcanonicallocales/should-polyfill.js';
import {shouldPolyfill as shouldPolyfillLocale} from '@formatjs/intl-locale/should-polyfill.js';
import {shouldPolyfill as shouldPolyfillPlural} from '@formatjs/intl-pluralrules/should-polyfill.js';

if (shouldPolyfillCanonical()) {
    require('@formatjs/intl-getcanonicallocales/polyfill.js');
}

if (shouldPolyfillLocale()) {
    require('@formatjs/intl-locale/polyfill.js');
}

// The app ships three locales; each needs its plural rules loaded explicitly.
if (shouldPolyfillPlural('en')) {
    require('@formatjs/intl-pluralrules/polyfill-force.js');
    require('@formatjs/intl-pluralrules/locale-data/en');
    require('@formatjs/intl-pluralrules/locale-data/fr');
    require('@formatjs/intl-pluralrules/locale-data/ar');
}
