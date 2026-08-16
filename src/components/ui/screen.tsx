import {View, type ViewProps} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {StyleSheet} from 'react-native-unistyles';

/**
 * Themed screen container. Use this instead of `SafeAreaView`.
 *
 * Why this exists: `SafeAreaView` from react-native-safe-area-context renders a
 * *native spec* component (`specs/NativeSafeAreaView`), which Unistyles' Babel
 * plugin does not process. A themed style applied to it is resolved once and
 * then never updated, so switching light/dark leaves the background stuck on
 * its original color while every real `View` and `Text` around it re-themes.
 *
 * That failure is silent and ugly: the tab bar flips to dark, the body stays
 * white, and the text turns near-invisible against it. It was caught on a
 * simulator, not by `tsc` or by the bundler.
 *
 * A plain `View` plus `useSafeAreaInsets()` is processed normally and re-themes
 * correctly. Insets are applied as padding, which also composes better with
 * scroll views than the native component does.
 */

type Edge = 'top' | 'bottom' | 'left' | 'right';

export interface ScreenProps extends ViewProps {
    /**
     * Which insets to apply. Defaults to top only: a screen inside the tab
     * navigator must NOT pad the bottom, since the tab bar already covers it
     * and doing both leaves a visible dead strip.
     */
    edges?: Edge[];
}

export function Screen({edges = ['top'], style, children, ...rest}: ScreenProps) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.screen,
                {
                    paddingTop: edges.includes('top') ? insets.top : 0,
                    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
                    paddingLeft: edges.includes('left') ? insets.left : 0,
                    paddingRight: edges.includes('right') ? insets.right : 0,
                },
                style,
            ]}
            {...rest}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    screen: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
}));
