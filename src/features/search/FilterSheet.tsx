import {useEffect, useState} from 'react';
import {Pressable, ScrollView, TextInput, View} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Text, Button, Divider, Sheet, IconSymbol, Price} from '@/components/ui';
import {Chip} from './Chip';
import {
    EMPTY_FILTERS,
    SORT_MESSAGE_KEY,
    SORT_OPTIONS,
    activeFilterCount,
    groupFacets,
    toggleFacetValue,
    type FilterState,
    type SortKey,
} from './filter-state';
import type {SearchFacetValue} from '@/lib/types';
import {useTranslations} from './i18n';

/**
 * Filter + sort sheet.
 *
 * **Drafts, then applies.** The sheet edits a local copy and commits on
 * "Show results" or on dismiss. Live-applying each tap would refire the search
 * behind the sheet on every toggle, and on a 3.2k-product catalogue that is
 * several wasted round trips before the user has finished deciding. Applying
 * is instant because the result for the previous filter set stays on screen
 * (`keepPreviousData`) while the new one arrives.
 *
 * The price inputs take **major units** — nobody types centimes — and convert
 * at the boundary. Everything crossing back into `FilterState` is minor units,
 * as `Money` is everywhere else.
 */

const MINOR_UNIT_SCALE = 100;

export interface FilterSheetProps {
    open: boolean;
    onClose: () => void;
    value: FilterState;
    onApply: (next: FilterState) => void;
    facetValues: readonly SearchFacetValue[];
    /** Slider endpoints in minor units, or null when unknown. */
    bounds: {min: number; max: number} | null;
    currencyCode: string;
}

function toMajorInput(minor: number | null): string {
    if (minor === null) return '';
    return String(Math.round(minor / MINOR_UNIT_SCALE));
}

function toMinor(input: string): number | null {
    const digits = input.replace(/[^0-9]/g, '');
    if (!digits) return null;
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed * MINOR_UNIT_SCALE : null;
}

export function FilterSheet({
    open,
    onClose,
    value,
    onApply,
    facetValues,
    bounds,
    currencyCode,
}: FilterSheetProps) {
    const t = useTranslations('Filters');
    const tSort = useTranslations('Sort');
    const {theme} = useUnistyles();

    const [draft, setDraft] = useState<FilterState>(value);
    const [minText, setMinText] = useState(() => toMajorInput(value.minPrice));
    const [maxText, setMaxText] = useState(() => toMajorInput(value.maxPrice));

    // Re-seed each time the sheet opens: a draft left over from a dismissed
    // edit must not reappear as if it had been applied.
    useEffect(() => {
        if (!open) return;
        setDraft(value);
        setMinText(toMajorInput(value.minPrice));
        setMaxText(toMajorInput(value.maxPrice));
    }, [open, value]);

    const groups = groupFacets(facetValues);
    const count = activeFilterCount(draft);

    const commit = () => {
        onApply({...draft, minPrice: toMinor(minText), maxPrice: toMinor(maxText)});
        onClose();
    };

    const clearAll = () => {
        setDraft({...EMPTY_FILTERS, sort: draft.sort});
        setMinText('');
        setMaxText('');
    };

    return (
        <Sheet open={open} onClose={onClose} title={t('title')} height={0.86}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
            >
                {/* sort ------------------------------------------------ */}
                <Text variant="caption" color="textMuted" uppercase>
                    {t('sortTitle')}
                </Text>
                <View style={styles.chipRow}>
                    {SORT_OPTIONS.map(option => (
                        <Chip
                            key={option}
                            label={tSort(SORT_MESSAGE_KEY[option])}
                            selected={draft.sort === option}
                            onPress={() => setDraft(current => ({...current, sort: option as SortKey}))}
                        />
                    ))}
                </View>

                <Divider />

                {/* availability ---------------------------------------- */}
                <Text variant="caption" color="textMuted" uppercase>
                    {t('availability')}
                </Text>
                <Pressable
                    onPress={() =>
                        setDraft(current => ({...current, inStockOnly: !current.inStockOnly}))
                    }
                    accessibilityRole="switch"
                    accessibilityState={{checked: draft.inStockOnly}}
                    accessibilityLabel={t('inStock')}
                    style={styles.toggleRow}
                >
                    <Text variant="body">{t('inStock')}</Text>
                    <View
                        style={[
                            styles.checkbox,
                            draft.inStockOnly && {
                                backgroundColor: theme.colors.brand,
                                borderColor: theme.colors.brand,
                            },
                        ]}
                    >
                        {draft.inStockOnly ? (
                            <IconSymbol name="check" size={14} color="onBrand" />
                        ) : null}
                    </View>
                </Pressable>

                <Divider />

                {/* price ------------------------------------------------ */}
                <View style={styles.sectionHead}>
                    <Text variant="caption" color="textMuted" uppercase>
                        {t('price')}
                    </Text>
                    {bounds ? (
                        <View style={styles.boundsRow}>
                            <Price value={bounds.min} currencyCode={currencyCode} size="sm" tone="textMuted" />
                            <Text variant="micro" color="textMuted">
                                –
                            </Text>
                            <Price value={bounds.max} currencyCode={currencyCode} size="sm" tone="textMuted" />
                        </View>
                    ) : null}
                </View>

                <View style={styles.priceRow}>
                    <View style={styles.priceField}>
                        <Text variant="micro" color="textMuted">
                            {t('minPrice')}
                        </Text>
                        <TextInput
                            value={minText}
                            onChangeText={setMinText}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            placeholder={bounds ? toMajorInput(bounds.min) : '0'}
                            placeholderTextColor={theme.colors.textMuted}
                            style={styles.priceInput}
                            accessibilityLabel={t('minPrice')}
                        />
                    </View>
                    <View style={styles.priceField}>
                        <Text variant="micro" color="textMuted">
                            {t('maxPrice')}
                        </Text>
                        <TextInput
                            value={maxText}
                            onChangeText={setMaxText}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            placeholder={bounds ? toMajorInput(bounds.max) : '—'}
                            placeholderTextColor={theme.colors.textMuted}
                            style={styles.priceInput}
                            accessibilityLabel={t('maxPrice')}
                        />
                    </View>
                </View>

                {minText || maxText ? (
                    <Pressable
                        onPress={() => {
                            setMinText('');
                            setMaxText('');
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        style={styles.resetPrice}
                    >
                        <Text variant="caption" color="brand">
                            {t('resetPrice')}
                        </Text>
                    </Pressable>
                ) : null}

                {/* facets ---------------------------------------------- */}
                {groups.map(group => (
                    <View key={group.id} style={styles.section}>
                        <Divider />
                        <Text variant="caption" color="textMuted" uppercase>
                            {group.name}
                        </Text>
                        <View style={styles.chipRow}>
                            {group.values.map(facet => (
                                <Chip
                                    key={facet.id}
                                    label={facet.name}
                                    count={facet.count}
                                    selected={draft.facetValueIds.includes(facet.id)}
                                    onPress={() =>
                                        setDraft(current => toggleFacetValue(current, facet.id))
                                    }
                                />
                            ))}
                        </View>
                    </View>
                ))}
            </ScrollView>

            <View style={styles.footer}>
                <Button variant="ghost" onPress={clearAll} disabled={count === 0}>
                    {t('clearAll')}
                </Button>
                <View style={styles.footerPrimary}>
                    <Button variant="primary" onPress={commit} fullWidth>
                        {t('apply')}
                    </Button>
                </View>
            </View>
        </Sheet>
    );
}

const styles = StyleSheet.create(theme => ({
    scroll: {
        flexShrink: 1,
    },
    content: {
        gap: theme.spacing.md,
        paddingBottom: theme.spacing.lg,
    },
    section: {
        gap: theme.spacing.md,
    },
    sectionHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
    },
    boundsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 44,
    },
    checkbox: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.sm,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceElevated,
    },
    priceRow: {
        flexDirection: 'row',
        gap: theme.spacing.md,
    },
    priceField: {
        flex: 1,
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceElevated,
    },
    priceInput: {
        ...theme.typography.bodyStrong,
        color: theme.colors.text,
        fontVariant: ['tabular-nums'],
        paddingVertical: 0,
        textAlign: 'auto',
    },
    resetPrice: {
        alignSelf: 'flex-start',
        minHeight: 32,
        justifyContent: 'center',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingTop: theme.spacing.md,
    },
    footerPrimary: {
        flex: 1,
    },
}));
