import {Pressable, View} from 'react-native';
import Animated, {FadeIn} from 'react-native-reanimated';
import {StyleSheet} from 'react-native-unistyles';
import {Text, IconSymbol} from '@/components/ui';
import {SORT_MESSAGE_KEY, type FilterState} from './filter-state';
import {useTranslations} from './i18n';

/**
 * The row above the grid: result count, sort summary, filter trigger.
 *
 * The active-filter count is a badge on the trigger rather than a list of
 * chips: with several facets selected a chip row pushes the first result row
 * off screen, and the sheet is one tap away for the detail.
 */

export interface FilterBarProps {
    /** Null while the first count is still unknown — renders a placeholder. */
    totalItems: number | null;
    activeCount: number;
    filters: FilterState;
    onOpenFilters: () => void;
    /** Dimmed while a newer result set is in flight behind a stale one. */
    isRefreshing?: boolean;
}

export function FilterBar({
    totalItems,
    activeCount,
    filters,
    onOpenFilters,
    isRefreshing = false,
}: FilterBarProps) {
    const t = useTranslations('Search');
    const tFilters = useTranslations('Filters');
    const tSort = useTranslations('Sort');

    return (
        <View style={styles.bar}>
            <View style={styles.meta}>
                <Text
                    variant="caption"
                    color={isRefreshing ? 'textMuted' : 'text'}
                    tabular
                    numberOfLines={1}
                >
                    {totalItems === null
                        ? t('searching')
                        : t('resultsCount', {count: totalItems})}
                </Text>
                <Text variant="micro" color="textMuted" numberOfLines={1}>
                    {tSort(SORT_MESSAGE_KEY[filters.sort])}
                </Text>
            </View>

            <Pressable
                onPress={onOpenFilters}
                accessibilityRole="button"
                accessibilityLabel={tFilters('filtersButton')}
                hitSlop={8}
                style={styles.trigger}
            >
                <IconSymbol name="filter" size={16} color={activeCount > 0 ? 'brand' : 'text'} />
                <Text variant="caption" color={activeCount > 0 ? 'brand' : 'text'}>
                    {tFilters('filtersButton')}
                </Text>
                {activeCount > 0 ? (
                    <Animated.View entering={FadeIn.duration(140)} style={styles.badge}>
                        <Text variant="micro" color="onBrand" tabular>
                            {String(activeCount)}
                        </Text>
                    </Animated.View>
                ) : null}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
    },
    meta: {
        flexShrink: 1,
        gap: 2,
    },
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        minHeight: 36,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.full,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceElevated,
    },
    badge: {
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.brand,
    },
}));
