import {useCallback, useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {useLocalSearchParams, router, Stack} from 'expo-router';
import {
    Screen,
    Text,
    Button,
    ProductCard,
    ProductCardSkeleton,
    EmptyState,
    IconSymbol,
} from '@/components/ui';
import {useCollection} from '@/features/collection/queries';
import {useStockedCollections} from '@/features/collection/stocked-queries';
import {readProductCards} from '@/lib/types';
import {useCardsWithStock} from '@/features/product/card-stock';
import type {SortKey} from '@/lib/search-input';
import {Breadcrumbs} from '@/features/collection/components/Breadcrumbs';
import {SortControl} from '@/features/collection/components/SortControl';
import {CollectionTile} from '@/features/collection/components/CollectionTile';
import {S, tr} from '@/features/catalogue-strings';
import {recordCollectionVisit} from '@/features/explore/visited-collections';
import {QuickAddButton} from '@/features/cart/components/QuickAddButton';

/**
 * Collection listing.
 *
 * Paging is done by growing `take` rather than by an offset cursor. The hook is
 * a plain `useQuery` with `keepPreviousData`, so a larger take redraws the grid
 * in place with the previous page still on screen; an offset page would have to
 * concatenate pages by hand and would lose that continuity on a sort change.
 * The cost is refetching the earlier items, which for a 24-item page against a
 * search index is cheaper than the extra state.
 *
 * Sorting resets the take: keeping a grown page across a sort change would
 * fetch 100 items for a grid the user is about to scroll from the top anyway.
 */
const PAGE_SIZE = 24;

export default function CollectionScreen() {
    const {theme} = useUnistyles();
    const {slug} = useLocalSearchParams<{slug: string}>();

    const [sort, setSort] = useState<SortKey>('name-asc');
    const [take, setTake] = useState(PAGE_SIZE);

    const {data, isPending, isFetching, error, refetch, isRefetching} = useCollection(slug, {
        sort,
        take,
    });

    // Feeds the home screen's Explore more. Recorded once the collection
    // resolved, so a mistyped deep link does not count as interest.
    useEffect(() => {
        if (data?.collection) recordCollectionVisit(data.collection.slug);
    }, [data?.collection]);

    const products = useCardsWithStock(data ? readProductCards(data.products) : []);
    const total = data?.totalItems ?? 0;
    const hasMore = products.length < total;

    const onSort = useCallback((next: SortKey) => {
        setSort(next);
        setTake(PAGE_SIZE);
    }, []);

    const loadMore = useCallback(() => {
        if (isFetching) return;
        setTake(current => current + PAGE_SIZE);
    }, [isFetching]);

    // Memoised because it seeds the child-count query's candidate list; a
    // fresh array each render would re-key that query on every paint.
    const children = useMemo(() => data?.collection?.children ?? [], [data]);

    /**
     * Counts for the sub-collection rows.
     *
     * Without these the screen contradicted itself: the shop card advertised
     * "3 products" for Téléphonie (the whole subtree) while this screen said
     * "1 product", because a collection search matches the slug and *not* its
     * descendants. The other two lived one level down, behind rows that gave
     * no hint of it, and two sibling rows were empty dead ends.
     *
     * Labelling each row reconciles the two numbers and stops the taps that
     * land on nothing.
     */
    const childCandidates = useMemo(
        () => children.map(child => ({slug: child.slug, name: child.name, parentName: ''})),
        [children],
    );
    const childStock = useStockedCollections({candidates: childCandidates, take: 1, limit: 0});

    const childMeta = useCallback(
        (slug: string) => {
            const total = childStock.data?.totals?.[slug];
            if (total === undefined) return undefined;
            return total > 0
                ? tr('Collections.productsCount', {count: total})
                : S.emptyCategory;
        },
        [childStock.data],
    );

    const header = (
        <View style={styles.header}>
            <Breadcrumbs items={data?.collection?.breadcrumbs ?? []} />

            <View style={styles.titleBlock}>
                <Text variant="title">{data?.collection?.name ?? ' '}</Text>
            </View>

            {children.length > 0 ? (
                <View style={styles.children}>
                    {children.map(child => (
                        <View key={child.id} style={styles.childCell}>
                            <CollectionTile
                                layout="row"
                                name={child.name}
                                imageUrl={child.featuredAsset?.preview}
                                meta={childMeta(child.slug)}
                                onPress={() => router.push(`/collection/${child.slug}`)}
                            />
                        </View>
                    ))}
                </View>
            ) : null}

            <SortControl value={sort} onChange={onSort} totalItems={data ? total : undefined} />
        </View>
    );

    return (
        <Screen>
            <Stack.Screen options={{title: data?.collection?.name ?? ''}} />

            <View style={styles.navBar}>
                <Button variant="ghost" size="sm" icon="chevronBack" onPress={() => router.back()}>
                    {tr('Common.back')}
                </Button>
            </View>

            {error ? (
                <EmptyState
                    tone="error"
                    icon="offline"
                    title={S.serverUnreachableTitle}
                    message={error.message}
                    action={{label: S.tryAgain, onPress: () => void refetch()}}
                />
            ) : isPending ? (
                <View style={styles.skeletonGrid}>
                    {[0, 1, 2, 3, 4, 5].map(index => (
                        <View key={index} style={styles.skeletonCell}>
                            <ProductCardSkeleton />
                        </View>
                    ))}
                </View>
            ) : (
                <FlashList
                    data={products}
                    numColumns={2}
                    keyExtractor={item => item.productId}
                    ListHeaderComponent={header}
                    refreshing={isRefetching}
                    onRefresh={() => void refetch()}
                    onEndReached={hasMore ? loadMore : undefined}
                    onEndReachedThreshold={0.6}
                    renderItem={({item, index}) => (
                        <View
                            style={[
                                styles.cell,
                                // The gutter belongs between the columns only,
                                // applied on the reading-start side of the
                                // second column so it mirrors in Arabic.
                                index % 2 === 1 && {paddingStart: theme.spacing.md},
                            ]}
                        >
                            <ProductCard
                                product={item}
                                onPress={() => router.push(`/product/${item.slug}`)}
                                action={<QuickAddButton product={item} />}
                            />
                        </View>
                    )}
                    ListEmptyComponent={
                        <EmptyState
                            icon="empty"
                            title={S.noResults}
                            action={{label: S.viewAll, onPress: () => router.push('/shop')}}
                        />
                    }
                    ListFooterComponent={
                        hasMore ? (
                            <View style={styles.footer}>
                                <Button
                                    variant="secondary"
                                    loading={isFetching}
                                    onPress={loadMore}
                                    iconEnd="chevronDown"
                                >
                                    {tr('Common.loadMore')}
                                </Button>
                            </View>
                        ) : products.length > 0 ? (
                            <View style={styles.footer}>
                                <IconSymbol name="check" size={16} color="textMuted" />
                            </View>
                        ) : null
                    }
                    contentContainerStyle={{
                        paddingHorizontal: theme.spacing.lg,
                        paddingBottom: theme.spacing['3xl'],
                    }}
                />
            )}
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.sm,
        paddingBottom: theme.spacing.xs,
    },
    header: {
        gap: theme.spacing.sm,
        // Cancels the list's own horizontal padding so breadcrumbs and the sort
        // bar keep their own gutters and align with the grid edge.
        marginHorizontal: -theme.spacing.lg,
    },
    titleBlock: {paddingHorizontal: theme.spacing.lg},
    children: {
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.sm,
        paddingTop: theme.spacing.sm,
    },
    childCell: {},
    cell: {
        flex: 1,
        paddingBottom: theme.spacing.md,
    },
    skeletonGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
    },
    skeletonCell: {width: '47%', flexGrow: 1},
    footer: {
        alignItems: 'center',
        paddingVertical: theme.spacing.xl,
    },
}));
