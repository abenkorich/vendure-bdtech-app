import {useCallback, useMemo, useState} from 'react';
import {RefreshControl, ScrollView, View} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Screen, Text, Skeleton, EmptyState} from '@/components/ui';
import {useCollections} from '@/features/collection/queries';
import {useStockedCollections} from '@/features/collection/stocked-queries';
import {CollectionCard} from '@/features/collection/components/CollectionCard';
import {ProductRail} from '@/features/home/components/ProductRail';
import {useSiteConfig} from '@/lib/site-config';
import {useTranslations} from '@/i18n';
import {S} from '@/features/catalogue-strings';
import type {CollectionTreeNode} from '@/lib/types';

/**
 * Shop — browse by category.
 *
 * Replaces a text accordion. That accordion was accurate and lifeless: eleven
 * near-identical rows, asking a shopper to *read* their way to "the one with
 * the sensors in it" when the catalogue has a photograph for every top-level
 * collection.
 *
 * The layout is shaped by what this catalogue actually contains, measured
 * against the live API rather than assumed:
 *
 * - **Top-level collections are empty containers.** Their products live in
 *   children, so a card here opens the category rather than promising a
 *   listing that would come back empty.
 * - **Only 11 of 45 child collections carry stock**, and two whole top-level
 *   categories have none at all. So the product rails below are driven by
 *   `useStockedCollections`, which asks first and renders only what exists.
 *   Anything else would be a column of blank sections.
 *
 * The merchant's highlighted categories lead, in their configured order, since
 * that is the shop's own opinion about what matters.
 */

/** The first card is full-width; the rest pair up. */
const HERO_COUNT = 1;

export default function ShopScreen() {
    const {theme} = useUnistyles();
    const {config} = useSiteConfig();
    const t = useTranslations('Collections');

    const {data, isPending, error, refetch, isRefetching} = useCollections();
    const [refreshing, setRefreshing] = useState(false);

    const collections = useMemo(() => data ?? [], [data]);

    /**
     * Merchant order first, then everything else. `popularCategories` is the
     * shop's stated priority, and a browse screen that ignores it would
     * disagree with the home screen two taps away.
     */
    const ordered = useMemo(() => {
        const highlighted = config.popularCategories.collectionSlugs;
        const rank = new Map(highlighted.map((slug, index) => [slug, index]));

        return [...collections].sort((a, b) => {
            const rankA = rank.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
            const rankB = rank.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
            return rankA - rankB;
        });
    }, [collections, config.popularCategories.collectionSlugs]);

    /**
     * Rail candidates: every child collection, best-stocked first. Children
     * rather than parents because that is where this catalogue keeps its
     * products.
     */
    const candidates = useMemo(
        () =>
            ordered.flatMap(parent =>
                (parent.children ?? []).map(child => ({
                    slug: child.slug,
                    name: child.name,
                    parentName: parent.name,
                })),
            ),
        [ordered],
    );

    const stocked = useStockedCollections({candidates, take: 8, limit: 4});

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetch(), stocked.refetch()]);
        setRefreshing(false);
    }, [refetch, stocked]);

    const openCollection = useCallback((node: {slug: string}) => {
        router.push(`/collection/${node.slug}`);
    }, []);

    /**
     * What a category actually contains.
     *
     * Sub-collection count was the obvious label and the wrong one: two
     * categories advertise eight and zero sub-collections respectively while
     * holding *no products at all*, so the card promised a shop that isn't
     * there. Product totals say the useful thing, and say it honestly when the
     * answer is none.
     *
     * Falls back to the sub-collection count until the totals arrive, so the
     * first paint is not blank.
     */
    const subtitleFor = useCallback(
        (node: CollectionTreeNode) => {
            const totals = stocked.data?.totals;

            if (totals) {
                const own = totals[node.slug] ?? 0;
                const beneath = (node.children ?? []).reduce(
                    (sum, child) => sum + (totals[child.slug] ?? 0),
                    0,
                );
                const products = own + beneath;

                if (products > 0) return t('productsCount', {count: products});
                // Only claim emptiness once every candidate has been counted.
                if (!stocked.isPending) return t('emptyCategory');
            }

            const children = node.children?.length ?? 0;
            return children > 0 ? `${children} ${S.subCollections}` : undefined;
        },
        [stocked.data, stocked.isPending, t],
    );

    if (error && collections.length === 0) {
        return (
            <Screen>
                <View style={styles.header}>
                    <Text variant="title">{S.collectionsTitle}</Text>
                </View>
                <EmptyState
                    tone="error"
                    icon="offline"
                    title={S.serverUnreachableTitle}
                    message={error.message}
                    action={{label: S.tryAgain, onPress: () => void refetch()}}
                />
            </Screen>
        );
    }

    const heroes = ordered.slice(0, HERO_COUNT);
    const tiles = ordered.slice(HERO_COUNT);

    return (
        <Screen>
            <View style={styles.header}>
                <Text variant="title">{S.collectionsTitle}</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing || isRefetching}
                        onRefresh={() => void onRefresh()}
                        tintColor={theme.colors.textMuted}
                    />
                }
            >
                {isPending && collections.length === 0 ? (
                    <View style={styles.grid}>
                        <Skeleton width="100%" height={168} radius="lg" />
                        <View style={styles.row}>
                            <Skeleton width="48%" height={132} radius="lg" />
                            <Skeleton width="48%" height={132} radius="lg" />
                        </View>
                        <View style={styles.row}>
                            <Skeleton width="48%" height={132} radius="lg" />
                            <Skeleton width="48%" height={132} radius="lg" />
                        </View>
                    </View>
                ) : collections.length === 0 ? (
                    <EmptyState icon="grid" title={S.collectionsTitle} message={S.collectionsEmpty} />
                ) : (
                    <View style={styles.grid}>
                        {heroes.map((node, index) => (
                            <Animated.View
                                key={node.id}
                                entering={FadeInDown.delay(index * 40).duration(theme.motion.base)}
                            >
                                <CollectionCard
                                    size="hero"
                                    name={node.name}
                                    imageUrl={node.featuredAsset?.preview}
                                    meta={subtitleFor(node)}
                                    onPress={() => openCollection(node)}
                                />
                            </Animated.View>
                        ))}

                        {/* Pairs, so a stray odd card does not stretch to full
                            width and read as another hero. */}
                        {chunk(tiles, 2).map((pair, rowIndex) => (
                            <Animated.View
                                key={pair.map(node => node.id).join('-')}
                                style={styles.row}
                                entering={FadeInDown.delay(
                                    (rowIndex + HERO_COUNT) * 40,
                                ).duration(theme.motion.base)}
                            >
                                {pair.map(node => (
                                    <CollectionCard
                                        key={node.id}
                                        name={node.name}
                                        imageUrl={node.featuredAsset?.preview}
                                        meta={subtitleFor(node)}
                                        onPress={() => openCollection(node)}
                                    />
                                ))}
                                {pair.length === 1 ? <View style={styles.spacer} /> : null}
                            </Animated.View>
                        ))}
                    </View>
                )}

                {/* Product rails only for collections proven to have stock. */}
                {stocked.data?.rails?.map(collection => (
                    <ProductRail
                        key={collection.slug}
                        eyebrow={collection.parentName ?? t('pageTitle')}
                        title={collection.name}
                        products={collection.products}
                        onViewAll={() => router.push(`/collection/${collection.slug}`)}
                    />
                ))}

                {stocked.isPending && candidates.length > 0 ? (
                    <View style={styles.railSkeleton}>
                        <Skeleton width="45%" height={18} />
                        <View style={styles.row}>
                            <Skeleton width="45%" height={190} radius="lg" />
                            <Skeleton width="45%" height={190} radius="lg" />
                        </View>
                    </View>
                ) : null}
            </ScrollView>
        </Screen>
    );
}

/** Split a list into fixed-size rows. */
function chunk<T>(items: readonly T[], size: number): T[][] {
    const rows: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        rows.push(items.slice(index, index + size));
    }
    return rows;
}

const styles = StyleSheet.create(theme => ({
    header: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
    },
    content: {
        paddingBottom: theme.spacing['2xl'],
    },
    grid: {
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.md,
        paddingBottom: theme.spacing.xl,
    },
    row: {
        flexDirection: 'row',
        gap: theme.spacing.md,
    },
    spacer: {
        flex: 1,
    },
    railSkeleton: {
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.md,
    },
}));
