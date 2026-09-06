import {useMemo} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {router} from 'expo-router';
import {ProductCard, ProductCardSkeleton, Button, IconSymbol, Text} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {SectionHeader} from '@/features/home/components/SectionHeader';
import {useExploreFeed} from './queries';
import {QuickAddButton} from '@/features/cart/components/QuickAddButton';

/**
 * "Explore more": the open-ended tail of the home screen.
 *
 * Draws from the collections this device browsed, or from the merchant's
 * highlighted ones until there is a history, newest products first, and
 * grows on demand. Load more is a button rather than an infinite scroll: the
 * home screen is a `ScrollView` that already hosts the merchant's sections,
 * and an auto-loading feed inside it would fight the pull-to-refresh and the
 * pinned search bar for the same gesture.
 *
 * The grid is a plain wrapping row, not a virtualised list, because it lives
 * inside that ScrollView; a few dozen cards is what a shopper actually pages
 * through before leaving the screen, and a nested virtualiser would not
 * recycle anyway.
 */
export interface ExploreFeedProps {
    /** Collections to draw from, best first. */
    slugs: readonly string[];
    /** Whether `slugs` came from this device's history. Changes the subtitle only. */
    personalised: boolean;
}

const SKELETONS = [0, 1, 2, 3];

export function ExploreFeed({slugs, personalised}: ExploreFeedProps) {
    const t = useTranslations('Explore');
    const tCommon = useTranslations('Common');
    const feed = useExploreFeed(slugs);

    const cards = useMemo(() => {
        const seen = new Set<string>();
        const all = (feed.data?.pages ?? []).flatMap(page => page.products);
        // Pages overlap only when a product sits in two collections read on
        // different pages; the second sighting is dropped here.
        return all.filter(item => !seen.has(item.productId) && seen.add(item.productId));
    }, [feed.data]);

    if (slugs.length === 0) return null;
    if (!feed.isPending && cards.length === 0) return null;

    return (
        <View style={styles.root}>
            <SectionHeader
                eyebrow={t('eyebrow')}
                title={t('title')}
                subtitle={personalised ? t('fromHistory') : t('fromStore')}
            />

            <View style={styles.grid}>
                {feed.isPending
                    ? SKELETONS.map(index => (
                          <View key={index} style={styles.cell}>
                              <ProductCardSkeleton />
                          </View>
                      ))
                    : cards.map(product => (
                          <View key={product.productId} style={styles.cell}>
                              <ProductCard
                                  product={product}
                                  onPress={() => router.push(`/product/${product.slug}`)}
                                  action={<QuickAddButton product={product} />}
                              />
                          </View>
                      ))}
            </View>

            <View style={styles.footer}>
                {feed.hasNextPage ? (
                    <Button
                        variant="secondary"
                        loading={feed.isFetchingNextPage}
                        onPress={() => void feed.fetchNextPage()}
                        iconEnd="chevronDown"
                    >
                        {tCommon('loadMore')}
                    </Button>
                ) : cards.length > 0 ? (
                    <View style={styles.end}>
                        <IconSymbol name="check" size={16} color="textMuted" />
                        <Text variant="caption" color="textMuted">
                            {t('caughtUp')}
                        </Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        paddingTop: theme.spacing.md,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    cell: {
        // Two columns with one gutter between them.
        width: '47%',
        flexGrow: 1,
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
