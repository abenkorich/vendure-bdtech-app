import {Pressable} from 'react-native';
import {StyleSheet, UnistylesRuntime, useUnistyles} from 'react-native-unistyles';
import {IconSymbol} from './IconSymbol';
import {writeThemePreference} from '@/design/theme-preference';
import {useTranslations} from '@/i18n';

/**
 * Light/dark switch.
 *
 * The app follows the OS until this is tapped; tapping is the shopper saying
 * they want something else, so it turns adaptive themes off and remembers the
 * choice. There is no third "system" position: a control with three states
 * and one glyph is a puzzle, and the OS setting is still one uninstall-free
 * way back — clearing app data restores it.
 *
 * The glyph shows the *destination*, not the current state: a sun means
 * "tap for light". That is the common convention, and the accessible label
 * says it in words for anyone the convention fails.
 */
export function ThemeToggle() {
    const {theme} = useUnistyles();
    const t = useTranslations('Common');
    const isDark = theme.isDark;

    return (
        <Pressable
            accessibilityRole="switch"
            accessibilityState={{checked: isDark}}
            accessibilityLabel={isDark ? t('switchToLight') : t('switchToDark')}
            hitSlop={8}
            onPress={() => {
                const next = isDark ? 'light' : 'dark';
                UnistylesRuntime.setAdaptiveThemes(false);
                UnistylesRuntime.setTheme(next);
                writeThemePreference(next);
            }}
            style={styles.root}
        >
            <IconSymbol name={isDark ? 'sun' : 'moon'} size={22} color="text" />
        </Pressable>
    );
}

const styles = StyleSheet.create(() => ({
    root: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
}));
