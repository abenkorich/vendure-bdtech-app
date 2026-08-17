import {Pressable, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, IconSymbol, Price, type IconName} from '@/components/ui';

/**
 * Selectable option row — delivery methods, payment methods, saved addresses.
 *
 * The selection marker is a filled ring drawn from two views rather than a
 * platform radio: the native control is another spec component Unistyles
 * cannot theme, and it also cannot carry the trailing price a delivery row
 * needs.
 *
 * Selection is never signalled by color alone. The ring fills *and* the border
 * turns brand *and* the label goes semibold, so the choice survives a
 * grayscale screenshot and a color-blind reader.
 */

export interface OptionRowProps {
    selected: boolean;
    onPress: () => void;
    title: string;
    description?: string;
    icon?: IconName;
    /** Trailing price in integer minor units. Rendered through `<Price>`. */
    priceWithTax?: number;
    currencyCode?: string;
    /** Copy shown instead of a price, e.g. "FREE". */
    priceLabel?: string;
    disabled?: boolean;
}

export function OptionRow({
    selected,
    onPress,
    title,
    description,
    icon,
    priceWithTax,
    currencyCode,
    priceLabel,
    disabled = false,
}: OptionRowProps) {
    styles.useVariants({selected, disabled});

    return (
        <Pressable
            accessibilityRole="radio"
            accessibilityState={{selected, disabled}}
            accessibilityLabel={title}
            disabled={disabled}
            onPress={onPress}
            style={styles.row}
        >
            <View style={styles.ring}>{selected ? <View style={styles.dot} /> : null}</View>

            {icon ? (
                <IconSymbol name={icon} size={18} color={selected ? 'brand' : 'textMuted'} />
            ) : null}

            <View style={styles.body}>
                <Text variant={selected ? 'bodyStrong' : 'body'} numberOfLines={2}>
                    {title}
                </Text>
                {description ? (
                    <Text variant="micro" color="textMuted" numberOfLines={3}>
                        {description}
                    </Text>
                ) : null}
            </View>

            {priceLabel ? (
                <Text variant="caption" color="success" tabular>
                    {priceLabel}
                </Text>
            ) : priceWithTax != null && currencyCode ? (
                <Price
                    value={priceWithTax}
                    currencyCode={currencyCode}
                    size="sm"
                    tone={selected ? 'brand' : 'text'}
                />
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create(theme => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        minHeight: 56,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        variants: {
            selected: {
                true: {
                    borderColor: theme.colors.brand,
                    backgroundColor: theme.colors.brandMuted,
                },
                false: {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                },
            },
            disabled: {
                true: {opacity: 0.45},
                false: {},
            },
        },
    },
    ring: {
        width: 20,
        height: 20,
        borderRadius: theme.radius.full,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        variants: {
            selected: {
                true: {borderColor: theme.colors.brand},
                false: {borderColor: theme.colors.border},
            },
            disabled: {true: {}, false: {}},
        },
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.brand,
    },
    body: {flex: 1, gap: theme.spacing.xs},
}));
