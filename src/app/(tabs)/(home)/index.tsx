import {useCallback, useState} from 'react';
import {Alert, RefreshControl, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {
    runOnJS,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Screen, EmptyState} from '@/components/ui';
import {useQueryClient} from '@tanstack/react-query';
import {useCollections} from '@/features/collection/queries';
import {useBlogRail} from '@/features/blog/queries';
import {CategoryGrid} from '@/features/home/components/CategoryGrid';
import {BlogRail} from '@/features/home/components/BlogRail';
import {HomeHeader, HOME_HEADER_HEIGHT} from '@/features/home/components/HomeHeader';
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
 * **The header is a sibling of the scroll view, not a sticky child.** It used
 * to be `stickyHeaderIndices`, and on Android that silently cost the search
 * box and the category strip their taps: a sticky header is translated by the
 * scroll view, and Android's touch dispatch does not follow it. So the header
 * is positioned over the list instead, the list is padded by its height, and
 * the brand row collapses on scroll — the same effect (logo scrolls away,
 * search and categories stay) on a view that reliably receives touches.
 */
export default function HomeScreen() {
    const {theme} = useUnistyles();
    const insets = useSafeAreaInsets();

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

    /* ------------------------------------------------------------ header */

    /**
     * The brand row's height is a constant (see `HOME_HEADER_HEIGHT`): it is
     * the part that gets clipped, and a clipped view cannot measure itself.
     * The pinned block is measured, because whether the category strip has
     * anything to show is not known in advance — and nothing clips it, so the
     * reading is stable.
     */
    const brandHeight = HOME_HEADER_HEIGHT;
    const [pinnedHeight, setPinnedHeight] = useState(0);
    /**
     * The header carries the safe-area inset itself. An absolutely positioned
     * view is placed against its parent's *border* box, so it ignores the
     * padding `Screen` would otherwise apply — which is why this screen asks
     * `Screen` for no edges and pads here instead. Getting that wrong put the
     * logo under the status bar and left a gap above the hero.
     */
    const headerPadTop = insets.top + theme.spacing.xs;
    const headerHeight = headerPadTop + brandHeight + pinnedHeight;

    const scrollY = useSharedValue(0);

    /** Clips the brand row as it slides away, so nothing bleeds into the notch. */
    const brandClipStyle = useAnimatedStyle(() => ({
        height: Math.max(0, brandHeight - Math.min(scrollY.value, brandHeight)),
    }));

    /** Slides and fades the row inside that clip, rather than cropping it. */
    const brandSlideStyle = useAnimatedStyle(() => {
        const collapsed = Math.min(scrollY.value, brandHeight);
        return {
            transform: [{translateY: -collapsed}],
            opacity: brandHeight > 0 ? 1 - collapsed / brandHeight : 1,
        };
    });

    /* -------------------------------------------------------------- feed */

    /**
     * Within this many points of the bottom, the Explore feed loads its next
     * page. About two rows of cards: early enough that a steady scroll never
     * hits the end, late enough that a glance at the hero costs no request.
     */
    const NEAR_END = 700;
    const [nearEnd, setNearEnd] = useState(false);
    const nearEndFlag = useSharedValue(false);

    const onScroll = useAnimatedScrollHandler(event => {
        scrollY.value = event.contentOffset.y;

        const remaining =
            event.contentSize.height - (event.contentOffset.y + event.layoutMeasurement.height);
        const next = remaining < NEAR_END;
        // Crossing the threshold is rare; the header follows every frame on
        // the UI thread, and only this hop reaches React.
        if (next !== nearEndFlag.value) {
            nearEndFlag.value = next;
            runOnJS(setNearEnd)(next);
        }
    });

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

    const brandRow = (
        <HomeHeader logoUrl={config.header.logoUrl} siteName={config.header.siteName} />
    );

    const searchBar = (
        <SearchBar
            placeholderTerm={config.search.popularTerms[0]}
            onImageSearch={() =>
                Alert.alert(tSearch('imageSearchSoonTitle'), tSearch('imageSearchSoonBody'))
            }
        />
    );

    if (allFailed) {
        return (
            <Screen>
                {brandRow}
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
        <Screen edges={[]}>
            <Animated.ScrollView
                contentContainerStyle={[styles.content, {paddingTop: headerHeight}]}
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.colors.textMuted}
                        // Otherwise the spinner turns underneath the header.
                        progressViewOffset={headerHeight}
                    />
                }
            >
                {config.home.sections.map(renderSection)}

                {/* Always last, and not a configurable section: it is the
                    open-ended tail that keeps the screen worth scrolling
                    once the merchant's sections run out. */}
                <ExploreFeed
                    slugs={exploreSlugs}
                    personalised={visited.length > 0}
                    nearEnd={nearEnd}
                />
            </Animated.ScrollView>

            {/* After the scroll view, so it draws — and receives touches —
                above it on both platforms. */}
            <View style={[styles.header, {paddingTop: headerPadTop}]}>
                <Animated.View style={[styles.brandClip, brandClipStyle]}>
                    <Animated.View style={brandSlideStyle}>{brandRow}</Animated.View>
                </Animated.View>

                <View onLayout={event => setPinnedHeight(event.nativeEvent.layout.height)}>
                    {searchBar}
                    <CategoryStrip
                        slugs={config.popularCategories.collectionSlugs}
                        collections={collections.data}
                        isLoading={collections.isPending}
                        showViewMore={config.popularCategories.showViewMore}
                    />
                </View>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingBottom: theme.spacing['3xl'],
    },
    brandClip: {
        overflow: 'hidden',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        // Opaque: the list scrolls underneath it.
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
        zIndex: 10,
    },
}));
