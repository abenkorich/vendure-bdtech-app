import {useCallback} from 'react';
import {Alert, RefreshControl, ScrollView, View} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Screen, EmptyState} from '@/components/ui';
import {useDeals, useNewArrivals} from '@/features/home/queries';
import {useCollections} from '@/features/collection/queries';
import {useBlogRail} from '@/features/blog/queries';
import {ProductRail} from '@/features/home/components/ProductRail';
import {CategoryGrid} from '@/features/home/components/CategoryGrid';
import {BlogRail} from '@/features/home/components/BlogRail';
import {HomeHeader} from '@/features/home/components/HomeHeader';
import {SearchBar} from '@/features/home/components/SearchBar';
import {CategoryStrip} from '@/features/home/components/CategoryStrip';
import {HeroSlider} from '@/features/home/components/HeroSlider';
import {useSiteConfig} from '@/lib/site-config';
import {env} from '@/lib/env';
import {useTranslations} from '@/i18n';
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
 *
 * The brand row scrolls away with the content; the search bar and the category
 * strip stay pinned (`stickyHeaderIndices`). That keeps the two things a
 * shopper reaches for mid-scroll within thumb reach without spending the
 * height of the logo row on every screen.
 */
export default function HomeScreen() {
    const {theme} = useUnistyles();

    const {config} = useSiteConfig();
    const tSearch = useTranslations('Search');

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

    const header = (
        <HomeHeader
            logoUrl={config.header.logoUrl}
            siteName={config.header.siteName}
        />
    );

    const searchBar = (
        <SearchBar
            placeholderTerm={config.search.popularTerms[0]}
            onImageSearch={() =>
                Alert.alert(
                    tSearch('imageSearchSoonTitle'),
                    tSearch('imageSearchSoonBody'),
                )
            }
        />
    );

    if (allFailed) {
        return (
            <Screen>
                {header}
                {searchBar}
                <EmptyState
                    tone="error"
                    icon="offline"
                    title={S.serverUnreachableTitle}
                    message={S.serverUnreachableBody}
                    action={{label: S.tryAgain, onPress: onRefresh}}
                />
            </Screen>
        );
    }

    return (
        <Screen>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                // Index 1 is the search + categories block; the brand row at
                // index 0 scrolls away.
                stickyHeaderIndices={[1]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.colors.textMuted}
                    />
                }
            >
                {header}

                {/* Opaque, so content scrolling underneath does not show
                    through the pinned block. Categories sit right under the
                    search bar: this is the marketplace ordering the merchant
                    asked for, and it keeps both merchant-controlled surfaces
                    reachable at any scroll position. */}
                <View style={styles.pinned}>
                    {searchBar}
                    <CategoryStrip
                        slugs={config.popularCategories.collectionSlugs}
                        collections={collections.data}
                        isLoading={collections.isPending}
                        showViewMore={config.popularCategories.showViewMore}
                    />
                </View>

                <HeroSlider hero={config.hero} assetBaseUrl={env.siteUrl} />

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
    pinned: {
        backgroundColor: theme.colors.background,
        paddingTop: theme.spacing.xs,
    },
}));
