import {StyleSheet} from 'react-native-unistyles';
import {lightTheme, darkTheme} from '@/design/tokens';

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
