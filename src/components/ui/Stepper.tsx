import {Pressable, View} from 'react-native';
import * as Haptics from 'expo-haptics';
import {StyleSheet} from 'react-native-unistyles';
import {Text} from './Text';
import {IconSymbol} from './IconSymbol';
import {useTranslations} from '@/i18n';

/**
 * Quantity stepper — cart lines and add-to-cart.
 *
 * Fires `onChange` immediately on tap; the caller is responsible for the
 * optimistic update. The UI must never wait on a round-trip to reflect a tap,
 * so this component has no internal loading state by design.
 *
 * The row is laid out with flex and `gap`, so it reverses correctly in Arabic:
 * minus stays on the leading edge, plus on the trailing edge, which is what a
 * right-to-left reader expects.
 */

export interface StepperProps {
    value: number;
    onChange: (next: number) => void;
    /** Defaults to 1. Pass 0 where stepping to zero means "remove". */
    min?: number;
    /** Usually the variant's stock level. */
    max?: number;
    size?: 'sm' | 'md';
    /** Blocks both buttons — e.g. while a line is being removed. */
    disabled?: boolean;
    /** Accessible name, e.g. the product title. */
    label?: string;
}

export function Stepper({
    value,
    onChange,
    min = 1,
    max = 99,
    size = 'md',
    disabled = false,
    label,
}: StepperProps) {
    const t = useTranslations('Cart');
    styles.useVariants({size});

    const canDecrement = !disabled && value > min;
    const canIncrement = !disabled && value < max;

    const step = (next: number) => {
        // A quantity change is a commitment with a cost attached; a light tick
        // confirms it landed without needing the user to re-read the number.
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(next);
    };

    return (
        <View style={styles.row} accessibilityLabel={label}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('decreaseQuantity')}
                accessibilityState={{disabled: !canDecrement}}
                disabled={!canDecrement}
                onPress={() => step(value - 1)}
                style={[styles.button, !canDecrement && styles.buttonDisabled]}
                hitSlop={8}
            >
                <IconSymbol
                    name={value === min && min === 0 ? 'trash' : 'remove'}
                    size={size === 'sm' ? 16 : 18}
                    color={canDecrement ? 'text' : 'textMuted'}
                />
            </Pressable>

            <View style={styles.valueBox}>
                <Text variant="bodyStrong" tabular numberOfLines={1}>
                    {String(value)}
                </Text>
            </View>

            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('increaseQuantity')}
                accessibilityState={{disabled: !canIncrement}}
                disabled={!canIncrement}
                onPress={() => step(value + 1)}
                style={[styles.button, !canIncrement && styles.buttonDisabled]}
                hitSlop={8}
            >
                <IconSymbol
                    name="add"
                    size={size === 'sm' ? 16 : 18}
                    color={canIncrement ? 'text' : 'textMuted'}
                />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceElevated,
        overflow: 'hidden',
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        variants: {
            size: {
                // `sm` is 36pt visually and reaches 44pt with its hitSlop.
                sm: {width: 36, height: 36},
                md: {width: 44, height: 44},
            },
        },
    },
    buttonDisabled: {
        opacity: 0.4,
    },
    valueBox: {
        alignItems: 'center',
        justifyContent: 'center',
        // Fixed width plus tabular digits: the row must not resize as the
        // quantity crosses from 9 to 10.
        variants: {
            size: {
                sm: {minWidth: 28, paddingHorizontal: theme.spacing.xs},
                md: {minWidth: 36, paddingHorizontal: theme.spacing.sm},
            },
        },
    },
}));
