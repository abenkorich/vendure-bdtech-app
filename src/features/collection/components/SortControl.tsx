import {useState} from 'react';
import {View, Pressable} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useTranslations} from '@/i18n';
import {Sheet, Text, IconSymbol, Divider} from '@/components/ui';
import type {SortKey} from '@/lib/search-input';
import {S} from '@/features/catalogue-strings';

/**
 * Sort control.
 *
 * A button that opens a bottom sheet, not an inline segmented control: four
 * options with long labels ("Price: Low to High") do not fit a row on a phone,
 * and truncating them makes two of them identical.
 */
export const SORT_OPTIONS: ReadonlyArray<{key: SortKey; label: string}> = [
    {key: 'name-asc', label: S.sortNameAsc},
    {key: 'name-desc', label: S.sortNameDesc},
    {key: 'price-asc', label: S.sortPriceAsc},
    {key: 'price-desc', label: S.sortPriceDesc},
];

export interface SortControlProps {
    value: SortKey;
    onChange: (value: SortKey) => void;
    /** Result count rendered beside the control, e.g. "128". */
    totalItems?: number;
}

export function SortControl({value, onChange, totalItems}: SortControlProps) {
    const t = useTranslations('Collections');
    const [open, setOpen] = useState(false);
    const active = SORT_OPTIONS.find(option => option.key === value) ?? SORT_OPTIONS[0];

    return (
        <View style={styles.bar}>
            {totalItems != null ? (
                <Text variant="caption" color="textMuted" tabular>
                    {t('productsCount', {count: totalItems})}
                </Text>
            ) : (
                <View style={styles.spacer} />
            )}

            <Pressable
                accessibilityRole="button"
                accessibilityLabel={S.sortPlaceholder}
                accessibilityValue={{text: active.label}}
                onPress={() => setOpen(true)}
                style={styles.trigger}
            >
                <IconSymbol name="sort" size={16} color="textMuted" />
                <Text variant="caption" numberOfLines={1}>
                    {active.label}
                </Text>
            </Pressable>

            <Sheet open={open} onClose={() => setOpen(false)} title={S.sortPlaceholder}>
                <View style={styles.options}>
                    {SORT_OPTIONS.map((option, index) => (
                        <View key={option.key}>
                            {index > 0 ? <Divider /> : null}
                            <Pressable
                                accessibilityRole="radio"
                                accessibilityState={{selected: option.key === value}}
                                onPress={() => {
                                    onChange(option.key);
                                    setOpen(false);
                                }}
                                style={styles.option}
                            >
                                <Text
                                    variant={option.key === value ? 'bodyStrong' : 'body'}
                                    color={option.key === value ? 'brand' : 'text'}
                                    style={styles.optionLabel}
                                >
                                    {option.label}
                                </Text>
                                {option.key === value ? (
                                    <IconSymbol name="check" size={18} color="brand" />
                                ) : null}
                            </Pressable>
                        </View>
                    ))}
                </View>
            </Sheet>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
    },
    spacer: {flex: 1},
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.full,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        minHeight: 36,
        maxWidth: '62%',
    },
    options: {
        paddingBottom: theme.spacing.md,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: 48,
    },
    optionLabel: {flex: 1},
}));
