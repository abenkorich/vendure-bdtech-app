import {useCallback, useState} from 'react';
import {Alert, RefreshControl, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import {FlashList} from '@shopify/flash-list';
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
import {
    ExploreFooter,
    ExploreHeading,
    ExploreRow,
    ExploreSkeletonRow,
    useExploreCards,
    type ExploreRowData,
} from '@/features/explore/ExploreFeed';
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
 * **The screen is one virtualised list.** It was a `ScrollView`, which is fine
 * for the merchant's handful of sections but not for the Explore feed under
 * them: that feed has no end, so a shopper who kept loading held every card
 * and every image mounted at once. Android showed it first — the tab juddered
 * there while the simulator stayed smooth, and every screen that was already
 * a `FlashList` was fine. The sections ride in the list header, which keeps
 * them mounted as before; the feed's rows recycle.
 *
 * **The header is a sibling of the scroll view, not a sticky child.** It used
 * to be `stickyHeaderIndices`, and on Android that silently cost the search
 * box and the category strip their taps: a sticky header is translated by the
 * scroll view, and Android's touch dispatch does not follow it. So the header
 * is positioned over the list instead, the list is padded by its height, and
 * the brand row collapses on scroll — the same effect (logo scrolls away,
 * search and categories stay) on a view that reliably receives touches.
 */
/**
 * Reanimated needs its own wrapper to drive the header from the scroll
 * position on the UI thread; the package's own `AnimatedFlashList` is the
 * React Native Animated one, which cannot take a worklet handler.
 */
const AnimatedFlashList = Animated.createAnimatedComponent(
    FlashList as unknown as React.ComponentType<
        React.ComponentProps<typeof FlashList<ExploreRowData>>
    >,
);

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

    /**
     * Both halves move by transform alone. An earlier version animated the
     * clip's `height`, which looks identical and is not: a height is laid out,
     * so every frame of every scroll ran a layout pass over the whole screen
     * and the home tab juddered while the others stayed smooth. Transforms
     * are composited, and cost nothing per frame.
     */
    const brandSlideStyle = useAnimatedStyle(() => {
        const collapsed = Math.min(scrollY.value, brandHeight);
        return {
            transform: [{translateY: -collapsed}],
            opacity: brandHeight > 0 ? 1 - collapsed / brandHeight : 1,
        };
    });

    /** The pinned block rides up into the space the brand row vacates. */
    const pinnedSlideStyle = useAnimatedStyle(() => ({
        transform: [{translateY: -Math.min(scrollY.value, brandHeight)}],
    }));

    /* -------------------------------------------------------------- feed */

    const explore = useExploreCards(exploreSlugs);

    /**
     * Only the header follows the scroll now — the list asks for its own next
     * page through `onEndReached`, so nothing has to hop back to React on
     * every frame to work out how close the end is.
     */
    const onScroll = useAnimatedScrollHandler(event => {
        scrollY.value = event.contentOffset.y;
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

    /**
     * Skeleton rows stand in while the first page loads, so the feed has the
     * grid's real geometry rather than appearing from nothing.
     */
    const rows: ExploreRowData[] = explore.isPending
        ? [
              {key: 'skeleton-0', products: []},
              {key: 'skeleton-1', products: []},
          ]
        : explore.rows;

    const renderRow = ({item}: {item: ExploreRowData}) =>
        explore.isPending ? <ExploreSkeletonRow /> : <ExploreRow products={item.products} />;

    /**
     * The merchant's sections ride in the header: a fixed handful, always
     * mounted, exactly as they were. Only the endless part below recycles.
     */
    const listHeader = (
        <>
            {config.home.sections.map(renderSection)}
            {explore.hasCards || explore.isPending ? (
                <ExploreHeading personalised={visited.length > 0} />
            ) : null}
        </>
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
            <AnimatedFlashList
                data={rows}
                keyExtractor={(item: ExploreRowData) => item.key}
                renderItem={renderRow}
                ListHeaderComponent={listHeader}
                ListFooterComponent={
                    <ExploreFooter
                        hasCards={explore.hasCards}
                        hasNextPage={explore.hasNextPage}
                        isFetchingNextPage={explore.isFetchingNextPage}
                        onLoadMore={explore.loadMore}
                    />
                }
                onEndReached={explore.loadMore}
                onEndReachedThreshold={0.8}
                contentContainerStyle={{paddingTop: headerHeight}}
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
            />

            {/* After the scroll view, so it draws — and receives touches —
                above it on both platforms. `box-none` throughout: once the
                brand row has collapsed the lower part of this box is empty,
                and a scroll started there has to reach the list. */}
            <View style={[styles.header, {height: headerHeight}]} pointerEvents="box-none">
                {/* The strip behind the status bar. Opaque on its own, so the
                    box below it can stay transparent. */}
                <View style={[styles.statusStrip, {height: headerPadTop}]} />

                <View style={{paddingTop: headerPadTop}} pointerEvents="box-none">
                    <View style={[styles.brandClip, {height: brandHeight}]}>
                        <Animated.View style={brandSlideStyle}>{brandRow}</Animated.View>
                    </View>

                    <Animated.View
                        style={[styles.pinnedBlock, pinnedSlideStyle]}
                        onLayout={event => setPinnedHeight(event.nativeEvent.layout.height)}
                    >
                        {searchBar}
                        <CategoryStrip
                            slugs={config.popularCategories.collectionSlugs}
                            collections={collections.data}
                            isLoading={collections.isPending}
                            showViewMore={config.popularCategories.showViewMore}
                        />
                    </Animated.View>
                </View>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingBottom: theme.spacing['3xl'],
    },
    /** Static height, so the row is cropped by the clip rather than by a
        height that changes every frame. */
    brandClip: {
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
    },
    pinnedBlock: {
        backgroundColor: theme.colors.background,
    },
    statusStrip: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: theme.colors.background,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        // Transparent: each band paints its own background, so the space the
        // collapsed brand row leaves behind shows the list through it.
        overflow: 'hidden',
        zIndex: 10,
    },
}));
