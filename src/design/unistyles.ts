import {StyleSheet, UnistylesRuntime} from 'react-native-unistyles';
import {lightTheme, darkTheme} from '@/design/tokens';
import {readThemePreference} from '@/design/theme-preference';

/**
 * Unistyles registration.
 *
 * Imported for its side effect from `src/app/_layout.tsx`, and it must run
 * before any component calls `StyleSheet.create`. The Babel plugin
 * (`react-native-unistyles/plugin`, rooted at `src`) rewrites those calls, so
 * a style file outside `src/` would silently not be processed.
 */

type AppThemes = {
    light: typeof lightTheme;
    dark: typeof darkTheme;
};

declare module 'react-native-unistyles' {
    export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
    themes: {
        light: lightTheme,
        dark: darkTheme,
    },
    settings: {
        // Follow the OS. The app is designed dark-first, but overriding a
        // user's system preference is the kind of thing that gets uninstalled.
        adaptiveThemes: true,
    },
});

/**
 * A shopper who has used the switch in the header overrides that default.
 * Applied here, as the runtime is configured, so the very first frame is
 * already in the right theme rather than flipping once a screen mounts.
 */
const preference = readThemePreference();
if (preference !== 'system') {
    UnistylesRuntime.setAdaptiveThemes(false);
    UnistylesRuntime.setTheme(preference);
}
