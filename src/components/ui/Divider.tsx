import {View, StyleSheet as RNStyleSheet} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

/**
 * Divider — a true hairline.
 *
 * `StyleSheet.hairlineWidth` rather than 1: on a 3x screen a 1pt rule is three
 * physical pixels and reads as a heavy line, which fights the precision-
 * instrument grid.
 */

export interface DividerProps {
    orientation?: 'horizontal' | 'vertical';
    /** Inset from the container's leading/trailing edge (direction-aware). */
    inset?: 'none' | 'sm' | 'md' | 'lg';
}

export function Divider({orientation = 'horizontal', inset = 'none'}: DividerProps) {
    styles.useVariants({orientation, inset});
    return <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no" />;
}

const styles = StyleSheet.create(theme => ({
    divider: {
        backgroundColor: theme.colors.border,
        variants: {
            orientation: {
                horizontal: {height: RNStyleSheet.hairlineWidth, alignSelf: 'stretch'},
                vertical: {width: RNStyleSheet.hairlineWidth, alignSelf: 'stretch'},
            },
            inset: {
                none: {},
                // Logical properties: an inset list rule must sit against the
                // text's leading edge, which is on the right in Arabic.
                sm: {marginStart: theme.spacing.sm},
                md: {marginStart: theme.spacing.md},
                lg: {marginStart: theme.spacing.lg},
            },
        },
    },
}));
