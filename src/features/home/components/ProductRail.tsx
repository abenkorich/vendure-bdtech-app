import {useCallback} from 'react';
import {View} from 'react-native';
// The list types come from FlashList, not React Native: RN's own
// `ListRenderItemInfo` requires `separators`, which FlashList does not pass.
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {router} from 'expo-router';
import {ProductCard, ProductCardSkeleton, EmptyState, Text} from '@/components/ui';
import {readProductCards, type ProductCardData} from '@/lib/types';
import {useCardsWithStock} from '@/features/product/card-stock';
import {SectionHeader} from './SectionHeader';
import {S} from '@/features/catalogue-strings';
import {QuickAddButton} from '@/features/cart/components/QuickAddButton';

/**
 * Horizontal product rail.
 *
 * One component covers every merchandising strip in the app (home rails,
 * related products), because they are the same object: a titled, horizontally
 * scrolling run of the same card the grid uses.
 *
 * States are explicit and distinguishable, which is the failure mode this
 * project has already been burned by: loading shows skeleton *cards* with the
 * rail's real geometry, an error offers a retry, and an empty rail renders
 * nothing at all (a merchandising rail with no products is a normal answer
 * from this backend — `dealProducts` currently returns zero — and an error
 * card there would be a lie).
 */

type RailCard = ReturnType<typeof readProductCards>[number];

export interface ProductRailProps {
    title: string;
    eyebrow?: string;
    subtitle?: string;
    products?: readonly ProductCardData[];
    isLoading?: boolean;
    error?: Error | null;
    onRetry?: () => void;
    /** "View all" target. Omitted when the rail has no listing page. */
    onViewAll?: () => void;
    /** Hide the whole section when there is nothing to show. Default true. */
    hideWhenEmpty?: boolean;
}

const SKELETONS = [0, 1, 2, 3];

export function ProductRail({
    title,
    eyebrow,
    subtitle,
    products,
    isLoading = false,
    error = null,
    onRetry,
    onViewAll,
    hideWhenEmpty = true,
}: ProductRailProps) {
    const {theme} = useUnistyles();

    // A rail built from `products` already knows its counts; one built from a
    // search does not, and this fills those in.
    const cards = useCardsWithStock(products ? readProductCards(products) : []);

    const renderItem = useCallback(
        ({item}: ListRenderItemInfo<RailCard>) => (
            <ProductCard
                layout="rail"
                product={item}
                onPress={() => router.push(`/product/${item.slug}`)}
                action={<QuickAddButton product={item} />}
            />
        ),
        [],
    );

    if (!isLoading && !error && cards.length === 0 && hideWhenEmpty) return null;

    return (
        <View style={styles.root}>
            <SectionHeader
                eyebrow={eyebrow}
                title={title}
                subtitle={subtitle}
                action={onViewAll && cards.length > 0 ? {label: S.viewAll, onPress: onViewAll} : undefined}
            />

            {error ? (
                <EmptyState
                    tone="error"
                    title={S.somethingWentWrong}
                    message={error.message}
                    action={onRetry ? {label: S.tryAgain, onPress: onRetry} : undefined}
                />
            ) : isLoading ? (
                <View style={styles.skeletonRow} accessibilityLabel={S.loading}>
                    {SKELETONS.map(index => (
                        <ProductCardSkeleton key={index} layout="rail" />
                    ))}
                </View>
            ) : cards.length === 0 ? (
                <View style={styles.empty}>
                    <Text variant="caption" color="textMuted">
                        {S.noResults}
                    </Text>
                </View>
            ) : (
                <FlashList
                    horizontal
                    data={cards}
                    renderItem={renderItem}
                    keyExtractor={item => item.productId}
                    showsHorizontalScrollIndicator={false}
                    // `gap` is not applied between FlashList cells, so the
                    // rhythm comes from a separator with a spacing-scale width.
                    ItemSeparatorComponent={RailSeparator}
                    contentContainerStyle={{paddingHorizontal: theme.spacing.lg}}
                />
            )}
        </View>
    );
}

function RailSeparator() {
    return <View style={styles.separator} />;
}

const styles = StyleSheet.create(theme => ({
    root: {
        paddingVertical: theme.spacing.lg,
    },
    separator: {
        width: theme.spacing.md,
    },
    skeletonRow: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        // Clipped rather than scrollable: a placeholder must not invite a
        // gesture that will not move anything.
        overflow: 'hidden',
    },
    empty: {
        paddingHorizontal: theme.spacing.lg,
    },
}));
