import {ActivityIndicator, Pressable, View, type PressableProps} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Text, type TextVariant} from './Text';
import {IconSymbol, type IconName} from './IconSymbol';

/**
 * Button.
 *
 * `primary` is the only variant that fills with the accent, and it is reserved
 * for the single most important action on a screen — that is what keeps the
 * accent a signal. Two primary buttons in one view means one of them is wrong.
 *
 * Every size clears the 44pt minimum touch target even when the visual box is
 * smaller, via `hitSlop` on `sm`.
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'notify';
export type ButtonSize = 'sm' | 'md' | 'lg';

const TEXT_VARIANT: Record<ButtonSize, TextVariant> = {
    sm: 'caption',
    md: 'bodyStrong',
    lg: 'bodyStrong',
};

const ICON_SIZE: Record<ButtonSize, number> = {sm: 16, md: 18, lg: 20};

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
    /** Button label. Optional only when `icon` is set (an icon-only button). */
    children?: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Swaps the label for a spinner and blocks presses. */
    loading?: boolean;
    disabled?: boolean;
    /** Leading icon, before the label in reading order. */
    icon?: IconName;
    /** Trailing icon, after the label in reading order. */
    iconEnd?: IconName;
    /** Stretch to the container width — for sticky CTAs and form submits. */
    fullWidth?: boolean;
}

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    iconEnd,
    fullWidth = false,
    onPress,
    ...rest
}: ButtonProps) {
    const {theme} = useUnistyles();
    const pressed = useSharedValue(0);
    const isInert = disabled || loading;

    styles.useVariants({variant, size, disabled: isInert});

    // Scale rather than opacity: on the dark surfaces this app lives on, a
    // fade reads as the button disappearing rather than being pressed.
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{scale: withSpring(1 - pressed.value * 0.03, theme.motion.spring)}],
        opacity: withSpring(1 - pressed.value * 0.15, theme.motion.spring),
    }));

    const foreground = FOREGROUND[variant];

    return (
        <AnimatedPressable
            accessibilityRole="button"
            accessibilityState={{disabled: isInert, busy: loading}}
            disabled={isInert}
            onPressIn={() => {
                pressed.value = 1;
            }}
            onPressOut={() => {
                pressed.value = 0;
            }}
            onPress={onPress}
            // `sm` is 36pt tall by design (it sits inside dense rows), so the
            // touch target is extended past the visual box rather than the box
            // being inflated.
            hitSlop={size === 'sm' ? 8 : undefined}
            style={[styles.base, fullWidth && styles.fullWidth, animatedStyle]}
            {...rest}
        >
            {loading ? (
                <ActivityIndicator size="small" color={theme.colors[foreground]} />
            ) : (
                <View style={styles.content}>
                    {icon ? (
                        <IconSymbol name={icon} size={ICON_SIZE[size]} color={foreground} />
                    ) : null}
                    {children ? (
                        <Text variant={TEXT_VARIANT[size]} color={foreground} numberOfLines={1}>
                            {children}
                        </Text>
                    ) : null}
                    {iconEnd ? (
                        <IconSymbol name={iconEnd} size={ICON_SIZE[size]} color={foreground} />
                    ) : null}
                </View>
            )}
        </AnimatedPressable>
    );
}

const FOREGROUND = {
    primary: 'onBrand',
    secondary: 'text',
    ghost: 'brand',
    danger: 'onBrand',
    notify: 'onNotify',
} as const satisfies Record<ButtonVariant, 'onBrand' | 'onNotify' | 'text' | 'brand'>;

const styles = StyleSheet.create(theme => ({
    base: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: 'transparent',
        alignSelf: 'flex-start',
        variants: {
            variant: {
                primary: {backgroundColor: theme.colors.brand},
                secondary: {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: theme.colors.border,
                },
                ghost: {backgroundColor: 'transparent'},
                danger: {backgroundColor: theme.colors.danger},
                notify: {backgroundColor: theme.colors.notify},
            },
            size: {
                sm: {
                    minHeight: 36,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.xs,
                },
                md: {
                    minHeight: 44,
                    paddingHorizontal: theme.spacing.lg,
                    paddingVertical: theme.spacing.sm,
                },
                lg: {
                    minHeight: 52,
                    paddingHorizontal: theme.spacing.xl,
                    paddingVertical: theme.spacing.md,
                },
            },
            disabled: {
                true: {opacity: 0.45},
                false: {},
            },
        },
    },
    fullWidth: {
        alignSelf: 'stretch',
        width: '100%',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
}));
