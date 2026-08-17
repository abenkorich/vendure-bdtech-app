/**
 * App entry.
 *
 * Unistyles must be configured before *any* module calls `StyleSheet.create`.
 * Importing it at the top of `app/_layout.tsx` is not sufficient: expo-router
 * builds its route tree from a require context, so route modules (and anything
 * they import, such as the design-system barrel) can execute before the root
 * layout's body runs. That surfaces as:
 *
 *   "Unistyles: One of your stylesheets is trying to get the theme, but no
 *    theme has been selected yet."
 *
 * Loading the configuration here, before `expo-router/entry`, makes the
 * ordering guaranteed rather than incidental.
 */
// Intl polyfills must load before anything formats a message: Hermes has no
// Intl.PluralRules, and our ICU formatter constructs one for any plural.
import './src/lib/intl-polyfill';
import './src/design/unistyles';
import 'expo-router/entry';
