import {useMemo} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {router} from 'expo-router';
import {ProductCard, ProductCardSkeleton, Button, IconSymbol, Text} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {SectionHeader} from '@/features/home/components/SectionHeader';
import {QuickAddButton} from '@/features/cart/components/QuickAddButton';
import {useExploreFeed, type FeedPage} from './queries';

/**
 * "Explore more": the open-ended tail of the home screen.
 *
 * Draws from the collections this device browsed, or from the merchant's
 * highlighted ones until there is a history, newest products first.
 *
 * The pieces are exported separately rather than as one component because
 * home renders them as rows of a virtualised list: the feed has no end, and
 * a shopper who keeps loading would otherwise hold every card and every
 * image mounted at once. Two cards per row, so the list stays single-column
 * and the merchant's full-width sections can share it.
 */

/** Already unmasked by `queries.ts`, so the cards arrive render-ready. */
type ExploreCard = FeedPage['products'][number];

export interface ExploreRowData {
    key: string;
    products: ExploreCard[];
}

export interface ExploreCards {
    rows: ExploreRowData[];
    hasCards: boolean;
    isPending: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    loadMore: () => void;
}

/** Products per row. Kept here so the row component and the data agree. */
const PER_ROW = 2;

export function useExploreCards(slugs: readonly string[]): ExploreCards {
    const feed = useExploreFeed(slugs);
    const {hasNextPage = false, isFetchingNextPage, fetchNextPage} = feed;

    const rows = useMemo(() => {
        const seen = new Set<string>();
        const all = (feed.data?.pages ?? []).flatMap(page => page.products);
        // Pages overlap only when a product sits in two collections read on
        // different pages; the second sighting is dropped.
        const cards = all.filter(
            item => !seen.has(item.productId) && seen.add(item.productId),
        );
        const grouped: ExploreRowData[] = [];
        for (let index = 0; index < cards.length; index += PER_ROW) {
            const products = cards.slice(index, index + PER_ROW);
            grouped.push({key: `explore-${products[0]?.productId ?? index}`, products});
        }
        return grouped;
    }, [feed.data]);

    return {
        rows,
        hasCards: rows.length > 0,
        isPending: feed.isPending,
        hasNextPage,
        isFetchingNextPage,
        loadMore: () => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        },
    };
}

/** The section heading, so the feed announces itself like any other section. */
export function ExploreHeading({personalised}: {personalised: boolean}) {
    const t = useTranslations('Explore');

    return (
        <SectionHeader
            eyebrow={t('eyebrow')}
            title={t('title')}
            subtitle={personalised ? t('fromHistory') : t('fromStore')}
        />
    );
}

export function ExploreRow({products}: {products: ExploreCard[]}) {
    return (
        <View style={styles.row}>
            {products.map(product => (
                <View key={product.productId} style={styles.cell}>
                    <ProductCard
                        product={product}
                        onPress={() => router.push(`/product/${product.slug}`)}
                        action={<QuickAddButton product={product} />}
                    />
                </View>
            ))}
            {/* Keeps a lone last card at half width instead of stretching. */}
            {products.length < PER_ROW ? <View style={styles.cell} /> : null}
        </View>
    );
}

export function ExploreSkeletonRow() {
    return (
        <View style={styles.row}>
            <View style={styles.cell}>
                <ProductCardSkeleton />
            </View>
            <View style={styles.cell}>
                <ProductCardSkeleton />
            </View>
        </View>
    );
}

export interface ExploreFooterProps {
    hasCards: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onLoadMore: () => void;
}

/**
 * The list already loads the next page as the end comes into view; this is
 * the visible sign that there is more, and the way back for anyone who stops
 * short of the threshold.
 */
export function ExploreFooter({
    hasCards,
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
}: ExploreFooterProps) {
    const t = useTranslations('Explore');
    const tCommon = useTranslations('Common');

    if (!hasCards) return null;

    return (
        <View style={styles.footer}>
            {hasNextPage ? (
                <Button variant="ghost" loading={isFetchingNextPage} onPress={onLoadMore}>
                    {isFetchingNextPage ? tCommon('loading') : tCommon('loadMore')}
                </Button>
            ) : (
                <View style={styles.end}>
                    <IconSymbol name="check" size={16} color="textMuted" />
                    <Text variant="caption" color="textMuted">
                        {t('caughtUp')}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    row: {
        flexDirection: 'row',
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.md,
        paddingBottom: theme.spacing.md,
    },
    cell: {
        flex: 1,
    },
    footer: {
        alignItems: 'center',
        paddingVertical: theme.spacing.xl,
    },
    end: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
}));
