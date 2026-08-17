import {useCallback} from 'react';
import {RefreshControl, ScrollView, View} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Screen, Text, EmptyState} from '@/components/ui';
import {useDeals, useNewArrivals} from '@/features/home/queries';
import {useCollections} from '@/features/collection/queries';
import {useBlogRail} from '@/features/blog/queries';
import {ProductRail} from '@/features/home/components/ProductRail';
import {CategoryGrid} from '@/features/home/components/CategoryGrid';
import {BlogRail} from '@/features/home/components/BlogRail';
import {S} from '@/features/catalogue-strings';

/**
 * Home.
 *
 * A stack of independent sections, each owning its own loading and error state.
 * That independence is the point: one failed rail must degrade to a retry in
 * place rather than blanking the screen, and one slow rail must not hold the
 * others back.
 *
 * The whole screen is only treated as failed when *every* section failed, which
 * is the signature of the connection being down rather than a resolver
 * misbehaving.
 *
 * A plain `ScrollView` hosts the sections rather than a virtualized list: the
 * page is a fixed handful of sections, and each rail is virtualized internally.
 */
export default function HomeScreen() {
    const {theme} = useUnistyles();

    const deals = useDeals(12);
    const newArrivals = useNewArrivals(12);
    const collections = useCollections();
    const blog = useBlogRail(6);

    const refreshing =
        deals.isRefetching || newArrivals.isRefetching || collections.isRefetching;

    const onRefresh = useCallback(() => {
        void deals.refetch();
        void newArrivals.refetch();
        void collections.refetch();
        void blog.refetch();
    }, [deals, newArrivals, collections, blog]);

    const allFailed =
        Boolean(newArrivals.error) && Boolean(collections.error) && Boolean(deals.error);

    return (
        <Screen>
            <View style={styles.header}>
                <Text variant="micro" color="brand" uppercase>
                    Dzduino
                </Text>
                {/* TODO(i18n): Home.pageTitle */}
                <Text variant="title">Your One-Stop Electronics Shop</Text>
            </View>

            {allFailed ? (
                <EmptyState
                    tone="error"
                    icon="offline"
                    title={S.serverUnreachableTitle}
                    message={S.serverUnreachableBody}
                    action={{label: S.tryAgain, onPress: onRefresh}}
                />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={theme.colors.textMuted}
                        />
                    }
                >
                    <ProductRail
                        eyebrow={S.newArrivalsEyebrow}
                        title={S.newArrivalsTitle}
                        products={newArrivals.data?.products}
                        isLoading={newArrivals.isPending}
                        error={newArrivals.error}
                        onRetry={() => void newArrivals.refetch()}
                        hideWhenEmpty={false}
                    />

                    {/* Deals is empty on this channel until a product carries a
                        deal flag; `hideWhenEmpty` keeps that from rendering a
                        permanently blank section header. */}
                    <ProductRail
                        eyebrow={S.dealsTitle}
                        title={S.dealsTitle}
                        subtitle={S.dealsSubtitle}
                        products={deals.data?.products}
                        isLoading={deals.isPending}
                        error={deals.error}
                        onRetry={() => void deals.refetch()}
                    />

                    <CategoryGrid
                        collections={collections.data}
                        isLoading={collections.isPending}
                    />

                    <BlogRail
                        posts={blog.data}
                        isLoading={blog.isPending}
                        error={blog.error}
                    />
                </ScrollView>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    header: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.sm,
        gap: theme.spacing.xs,
    },
    content: {
        paddingBottom: theme.spacing['3xl'],
    },
}));
