import {Pressable, View, type ViewProps} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

/**
 * Card — the elevation primitive.
 *
 * Raised by **tint plus a hairline border**, never a shadow: RN shadows render
 * differently on each platform and go muddy on the dark surfaces this app
 * mostly lives on, where a lighter fill reads as "closer" far more clearly.
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends ViewProps {
    /** `flat` sits on the background; `raised` steps up a level. */
    variant?: 'flat' | 'raised';
    padding?: CardPadding;
    /** Makes the whole card a touch target with a press spring. */
    onPress?: () => void;
    /** Marks the card as selected — a brand hairline, not a brand fill. */
    selected?: boolean;
    children?: React.ReactNode;
}

export function Card({
    variant = 'flat',
    padding = 'md',
    onPress,
    selected = false,
    style,
    children,
    ...rest
}: CardProps) {
    const {theme} = useUnistyles();
    const pressed = useSharedValue(0);

    styles.useVariants({variant, padding, selected});

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{scale: withSpring(1 - pressed.value * 0.02, theme.motion.spring)}],
    }));

    if (!onPress) {
        return (
            <View style={[styles.card, style]} {...rest}>
                {children}
            </View>
        );
    }

    return (
        <AnimatedPressable
            accessibilityRole="button"
            onPress={onPress}
            onPressIn={() => {
                pressed.value = 1;
            }}
            onPressOut={() => {
                pressed.value = 0;
            }}
            style={[styles.card, animatedStyle, style]}
            {...rest}
        >
            {children}
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create(theme => ({
    card: {
        borderRadius: theme.radius.lg,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        variants: {
            variant: {
                flat: {backgroundColor: theme.colors.surface},
                raised: {backgroundColor: theme.colors.surfaceElevated},
            },
            padding: {
                none: {padding: 0},
                sm: {padding: theme.spacing.sm},
                md: {padding: theme.spacing.md},
                lg: {padding: theme.spacing.lg},
            },
            selected: {
                true: {borderColor: theme.colors.brand},
                false: {},
            },
        },
    },
}));
