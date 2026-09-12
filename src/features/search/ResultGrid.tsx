import {useCallback} from 'react';
import {View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {StyleSheet} from 'react-native-unistyles';
import {ProductCard, ProductCardSkeleton} from '@/components/ui';
import type {SearchCard} from './use-filtered-search';
import {QuickAddButton} from '@/features/cart/components/QuickAddButton';
import {WishlistButton} from '@/features/wishlist/components/WishlistButton';
import {useCardsWithStock} from '@/features/product/card-stock';

/**
 * The 2-column result grid.
 *
 * FlashList rather than FlatList: a search can return several hundred cards
 * with remote images, and recycling is what keeps the scroll at 60fps while a
 * new query resolves behind it.
 *
 * Column spacing comes from a per-cell wrapper rather than
 * `columnWrapperStyle`, which FlashList does not support.
 */

export interface ResultGridProps {
    products: readonly SearchCard[];
    onPressProduct: (slug: string) => void;
    /** Rendered above the grid and scrolls with it: count, filter chips. */
    header?: React.ReactElement | null;
    footer?: React.ReactElement | null;
    onEndReached?: () => void;
}

export function ResultGrid({
    products,
    onPressProduct,
    header,
    footer,
    onEndReached,
}: ResultGridProps) {
    // Search results carry no stock count; this looks up the ones on screen.
    const cards = useCardsWithStock(products);

    const renderItem = useCallback(
        ({item}: {item: SearchCard}) => (
            <View style={styles.cell}>
                <ProductCard
                    product={item}
                    onPress={() => onPressProduct(item.slug)}
                    action={<QuickAddButton product={item} />}
                    favorite={<WishlistButton product={item} />}
                />
            </View>
        ),
        [onPressProduct],
    );

    return (
        <FlashList
            data={cards as SearchCard[]}
            numColumns={2}
            keyExtractor={item => item.productId}
            renderItem={renderItem}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            contentContainerStyle={styles.content}
            // The keyboard must retreat as soon as the user starts browsing
            // results, but tapping a card while it is open must still land on
            // the card rather than being eaten by the dismissal.
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onEndReached={onEndReached}
            onEndReachedThreshold={0.6}
            showsVerticalScrollIndicator={false}
        />
    );
}

/** Loading grid with the same geometry, so results land without a reflow. */
export function ResultGridSkeleton({count = 6}: {count?: number}) {
    return (
        <View style={styles.skeletonGrid}>
            {Array.from({length: count}, (_, index) => (
                <View key={index} style={styles.skeletonCell}>
                    <ProductCardSkeleton />
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingHorizontal: theme.spacing.md,
        paddingBottom: theme.spacing['3xl'],
    },
    cell: {
        flex: 1,
        padding: theme.spacing.xs,
    },
    skeletonGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: theme.spacing.md,
    },
    skeletonCell: {
        width: '50%',
        padding: theme.spacing.xs,
    },
}));
