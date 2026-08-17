import {View, Pressable} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Sheet, Text, Price, IconSymbol, Divider} from '@/components/ui';
import {
    availableOptionIds,
    selectOption,
    stockState,
    type OptionGroupLike,
    type Selection,
    type VariantLike,
} from '@/features/product/variant-selection';
import {S} from '@/features/catalogue-strings';

/**
 * Variant selector, presented in a bottom sheet.
 *
 * A sheet rather than inline chips because this catalogue's option groups are
 * long (resistance values, package types) and inline they push the price and
 * the add-to-cart button below the fold, which is the one thing a product page
 * must not do.
 *
 * Impossible combinations are rendered disabled rather than hidden: a value
 * that vanishes as you tap elsewhere reads as a rendering bug, where a dimmed
 * one reads as "not with that other choice".
 */
export interface VariantSheetProps {
    open: boolean;
    onClose: () => void;
    groups: readonly OptionGroupLike[];
    variants: readonly VariantLike[];
    selection: Selection;
    onSelectionChange: (selection: Selection) => void;
    currencyCode: string;
}

export function VariantSheet({
    open,
    onClose,
    groups,
    variants,
    selection,
    onSelectionChange,
    currencyCode,
}: VariantSheetProps) {
    return (
        <Sheet open={open} onClose={onClose} title={S.selectOptions}>
            <View style={styles.groups}>
                {groups.map((group, groupIndex) => {
                    const available = availableOptionIds(variants, selection, group.id);

                    return (
                        <View key={group.id} style={styles.group}>
                            {groupIndex > 0 ? <Divider /> : null}
                            <Text variant="micro" color="textMuted" uppercase>
                                {group.name}
                            </Text>

                            <View style={styles.options}>
                                {group.options.map(option => {
                                    const selected = selection[group.id] === option.id;
                                    const enabled = available.has(option.id);

                                    return (
                                        <Pressable
                                            key={option.id}
                                            accessibilityRole="radio"
                                            accessibilityState={{
                                                selected,
                                                disabled: !enabled,
                                            }}
                                            disabled={!enabled}
                                            onPress={() =>
                                                onSelectionChange(
                                                    selectOption(
                                                        variants,
                                                        selection,
                                                        group.id,
                                                        option.id,
                                                        groups.length,
                                                    ),
                                                )
                                            }
                                            style={[
                                                styles.chip,
                                                selected && styles.chipSelected,
                                                !enabled && styles.chipDisabled,
                                            ]}
                                        >
                                            <Text
                                                variant="caption"
                                                color={
                                                    selected
                                                        ? 'brand'
                                                        : enabled
                                                          ? 'text'
                                                          : 'textMuted'
                                                }
                                                tabular
                                            >
                                                {option.name}
                                            </Text>
                                            {selected ? (
                                                <IconSymbol name="check" size={14} color="brand" />
                                            ) : null}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    );
                })}

                <Divider />

                <View style={styles.variantList}>
                    {variants.map(variant => {
                        const state = stockState(variant.stockLevel);
                        const selected = variant.options.every(
                            option => selection[option.groupId] === option.id,
                        );

                        return (
                            <Pressable
                                key={variant.id}
                                accessibilityRole="button"
                                accessibilityState={{selected}}
                                onPress={() => {
                                    const next: Selection = {};
                                    for (const option of variant.options) {
                                        next[option.groupId] = option.id;
                                    }
                                    onSelectionChange(next);
                                }}
                                style={styles.variantRow}
                            >
                                <View style={styles.variantText}>
                                    <Text variant="caption" numberOfLines={1}>
                                        {variant.name}
                                    </Text>
                                    <Text variant="micro" color="textMuted" tabular numberOfLines={1}>
                                        {`${S.sku} ${variant.sku}`}
                                    </Text>
                                </View>

                                <Price
                                    value={variant.priceWithTax}
                                    currencyCode={currencyCode}
                                    size="sm"
                                    tone={state === 'out-of-stock' ? 'textMuted' : 'text'}
                                />
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </Sheet>
    );
}

const styles = StyleSheet.create(theme => ({
    groups: {gap: theme.spacing.md, paddingBottom: theme.spacing.md},
    group: {gap: theme.spacing.sm},
    options: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.full,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceElevated,
        minHeight: 36,
    },
    chipSelected: {
        // A brand hairline plus the muted wash, never a solid brand fill: the
        // accent marks the state, it does not become the surface.
        borderColor: theme.colors.brand,
        backgroundColor: theme.colors.brandMuted,
    },
    chipDisabled: {opacity: 0.4},
    variantList: {gap: theme.spacing.xs},
    variantRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        minHeight: 44,
    },
    variantText: {flex: 1, gap: 2},
}));
