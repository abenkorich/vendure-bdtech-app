import {useCallback, useState} from 'react';
import {
    Alert,
    RefreshControl,
    ScrollView,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Screen, EmptyState} from '@/components/ui';
import {useQueryClient} from '@tanstack/react-query';
import {useCollections} from '@/features/collection/queries';
import {useBlogRail} from '@/features/blog/queries';
import {CategoryGrid} from '@/features/home/components/CategoryGrid';
import {BlogRail} from '@/features/home/components/BlogRail';
import {HomeHeader} from '@/features/home/components/HomeHeader';
import {SearchBar} from '@/features/home/components/SearchBar';
import {CategoryStrip} from '@/features/home/components/CategoryStrip';
import {HeroSlider} from '@/features/home/components/HeroSlider';
import {PromoBanner} from '@/features/home/components/PromoBanner';
import {ConfiguredRail} from '@/features/home/components/ConfiguredRail';
import {ExploreFeed} from '@/features/explore/ExploreFeed';
import {useVisitedCollections} from '@/features/explore/visited-collections';
import {CATALOGUE_ROOT} from '@/lib/query-keys';
import type {HomeSection} from '@/lib/site-config/schema';
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
 * Which sections, and in what order, is the merchant's call: the customizer's
 * Mobile app pane composes hero, banners, product rails, the category grid and
 * the blog into `config.home.sections`, and this screen renders that list. The
 * bundled snapshot carries no list, so it falls back to the order the app
 * always had.
 *
 * The whole screen is only treated as failed when the collection tree failed
 * with nothing cached: that is the one query every layout needs, so it is the
 * signature of the connection being down rather than a resolver misbehaving.
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

    const queryClient = useQueryClient();
    const collections = useCollections();
    // The Explore feed follows what this device browsed; a fresh install
    // follows the merchant's highlighted categories until it has a history.
    const visited = useVisitedCollections();
    const exploreSlugs = visited.length > 0 ? visited : config.popularCategories.collectionSlugs;
    const blog = useBlogRail(6);

    const refreshing = collections.isRefetching;

    const onRefresh = useCallback(() => {
        void collections.refetch();
        void blog.refetch();
        // Every configured rail shares this key prefix; see useRailProducts.
        void queryClient.invalidateQueries({queryKey: [CATALOGUE_ROOT, 'app-rail']});
        void queryClient.invalidateQueries({queryKey: [CATALOGUE_ROOT, 'explore-feed']});
    }, [collections, blog, queryClient]);

    const allFailed = Boolean(collections.error) && !collections.data;

    /**
     * Within this many points of the bottom, the Explore feed loads its next
     * page. About two rows of cards: early enough that a steady scroll never
     * hits the end, late enough that a glance at the hero costs no request.
     */
    const NEAR_END = 700;
    const [nearEnd, setNearEnd] = useState(false);
    const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent;
        const remaining = contentSize.height - (contentOffset.y + layoutMeasurement.height);
        setNearEnd(remaining < NEAR_END);
    }, []);

    const renderSection = (section: HomeSection) => {
        switch (section.key) {
            case 'hero':
                return <HeroSlider key={section.id} hero={config.hero} assetBaseUrl={env.siteUrl} />;
            case 'banner':
                return section.banner ? <PromoBanner key={section.id} banner={section.banner} /> : null;
            case 'rail':
                return section.rail ? <ConfiguredRail key={section.id} rail={section.rail} /> : null;
            case 'categoryGrid':
                return (
                    <CategoryGrid
                        key={section.id}
                        collections={collections.data}
                        isLoading={collections.isPending}
                    />
                );
            case 'blog':
                return (
                    <BlogRail
                        key={section.id}
                        posts={blog.data}
                        isLoading={blog.isPending}
                        error={blog.error}
                    />
                );
        }
    };

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
                onScroll={onScroll}
                scrollEventThrottle={120}
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

                {config.home.sections.map(renderSection)}

                {/* Always last, and not a configurable section: it is the
                    open-ended tail that keeps the screen worth scrolling
                    once the merchant's sections run out. */}
                <ExploreFeed
                    slugs={exploreSlugs}
                    personalised={visited.length > 0}
                    nearEnd={nearEnd}
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
