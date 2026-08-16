import {View, type ViewProps} from 'react-native';
import {useSafeAreaInsets, type Edge} from 'react-native-safe-area-context';
import {StyleSheet} from 'react-native-unistyles';

/**
 * Screen — the root container every screen in the app must use.
 *
 * **Never use `SafeAreaView`.** It renders a native spec component that
 * Unistyles' Babel plugin cannot process, so its themed style resolves once and
 * then never updates: the background stays on whichever theme was active at
 * first render while text and chrome follow the real one, and the screen ends
 * up white with invisible white text. This component was written after hitting
 * exactly that on the showcase route.
 *
 * The fix is to apply insets as plain padding on an ordinary `View`, which the
 * plugin does process.
 */

export interface ScreenProps extends ViewProps {
    /**
     * Which edges to inset. Defaults to `['top']`: the bottom is usually owned
     * by a tab bar or a sticky CTA that should sit against the edge itself.
     */
    edges?: readonly Edge[];
    /** `background` (default) or `surface` for sheet-like modal screens. */
    variant?: 'background' | 'surface';
    /** Horizontal gutter from the spacing scale. */
    padded?: boolean;
    children?: React.ReactNode;
}

export function Screen({
    edges = ['top'],
    variant = 'background',
    padded = false,
    style,
    children,
    ...rest
}: ScreenProps) {
    const insets = useSafeAreaInsets();
    styles.useVariants({variant});

    return (
        <View
            style={[
                styles.screen,
                padded && styles.padded,
                {
                    paddingTop: edges.includes('top') ? insets.top : 0,
                    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
                    // Logical properties: `left`/`right` insets are physical
                    // (a notch does not move in Arabic), but the padding they
                    // produce is applied per-side rather than start/end so a
                    // landscape notch stays covered in both directions.
                    paddingLeft: edges.includes('left') ? insets.left : 0,
                    paddingRight: edges.includes('right') ? insets.right : 0,
                },
                style,
            ]}
            {...rest}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    screen: {
        flex: 1,
        variants: {
            variant: {
                background: {backgroundColor: theme.colors.background},
                surface: {backgroundColor: theme.colors.surface},
            },
        },
    },
    padded: {
        paddingHorizontal: theme.spacing.lg,
    },
}));
