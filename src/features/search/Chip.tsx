import {Pressable, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, IconSymbol} from '@/components/ui';

/**
 * Selectable chip — recent searches, suggestions, facet values.
 *
 * Selection is a brand hairline plus a muted wash, never a solid accent fill:
 * a grid of solid indigo chips would turn the accent from a signal into
 * decoration, which is the one rule this design system does not bend.
 */

export interface ChipProps {
    label: string;
    onPress: () => void;
    selected?: boolean;
    /** Trailing count, e.g. a facet's result total. Rendered tabular. */
    count?: number;
    /** Shows an × and calls `onRemove` — used by recent searches. */
    onRemove?: () => void;
    removeLabel?: string;
}

export function Chip({label, onPress, selected = false, count, onRemove, removeLabel}: ChipProps) {
    styles.useVariants({selected});

    return (
        <View style={styles.chip}>
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={{selected}}
                accessibilityLabel={label}
                style={styles.press}
                hitSlop={{top: 6, bottom: 6}}
            >
                {selected ? <IconSymbol name="check" size={13} color="brand" /> : null}
                <Text
                    variant="caption"
                    color={selected ? 'brand' : 'text'}
                    numberOfLines={1}
                    style={styles.label}
                >
                    {label}
                </Text>
                {typeof count === 'number' ? (
                    <Text variant="micro" color="textMuted" tabular>
                        {String(count)}
                    </Text>
                ) : null}
            </Pressable>

            {onRemove ? (
                <Pressable
                    onPress={onRemove}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={removeLabel ?? label}
                    style={styles.remove}
                >
                    <IconSymbol name="close" size={12} color="textMuted" />
                </Pressable>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: theme.radius.full,
        borderWidth: theme.elevation.card.borderWidth,
        // `paddingEnd` only: the remove button supplies its own end padding
        // when present, and both are logical so Arabic mirrors for free.
        paddingEnd: theme.spacing.xs,
        variants: {
            selected: {
                true: {
                    borderColor: theme.colors.brand,
                    backgroundColor: theme.colors.brandMuted,
                },
                false: {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surfaceElevated,
                },
            },
        },
    },
    press: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingStart: theme.spacing.md,
        paddingEnd: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        minHeight: 34,
    },
    label: {
        maxWidth: 180,
    },
    remove: {
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
}));
