import {useCallback} from 'react';
import {View, Pressable, ScrollView} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Text, IconSymbol, Skeleton} from '@/components/ui';
import {useTranslations} from '@/i18n';
import type {CollectionTreeNode} from '@/lib/types';

/**
 * Highlighted categories: a horizontal strip of circular tiles.
 *
 * Which categories appear, and in what order, comes from the customizer's
 * `popularCategories.collectionSlugs` — the merchant's choice, not an
 * alphabetical accident. Slugs that no longer resolve are dropped silently,
 * since a renamed collection should not leave a hole or an error on the home
 * screen.
 *
 * Circular tiles rather than the web's directory grid: this is the marketplace
 * pattern the merchant asked for, and it scans faster on a phone than a grid
 * of cards does.
 */

export interface CategoryStripProps {
    /** Ordered slugs from the customizer. */
    slugs: readonly string[];
    /** The full tree, used to resolve each slug to a name and image. */
    collections?: readonly CollectionTreeNode[];
    isLoading?: boolean;
    showViewMore?: boolean;
}

const SKELETONS = [0, 1, 2, 3, 4];

/**
 * Minimal shape this component needs. The query's tree type nests only one
 * level, so a recursive signature would not type-check against it; this covers
 * both a top-level collection and a child.
 */
interface CategoryLike {
    id: string;
    name: string;
    slug: string;
    featuredAsset?: {preview: string} | null;
}

function findBySlug(
    nodes: readonly CollectionTreeNode[],
    slug: string,
): CategoryLike | undefined {
    for (const node of nodes) {
        if (node.slug === slug) return node;

        // A merchant may highlight a sub-collection, so children are searched
        // too. The tree is two levels deep by construction.
        const child = node.children?.find(candidate => candidate.slug === slug);
        if (child) return child;
    }
    return undefined;
}

export function CategoryStrip({
    slugs,
    collections,
    isLoading = false,
    showViewMore = true,
}: CategoryStripProps) {
    const t = useTranslations('HomeSections');

    const resolve = useCallback(
        (slug: string) => (collections ? findBySlug(collections, slug) : undefined),
        [collections],
    );

    // Only the configured slugs, in the merchant's order, that still exist.
    const items = slugs
        .map(slug => resolve(slug))
        .filter((node): node is CategoryLike => node !== undefined);

    if (!isLoading && items.length === 0) return null;

    return (
        <View style={styles.root}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
            >
                {isLoading && items.length === 0
                    ? SKELETONS.map(index => (
                          <View key={index} style={styles.item}>
                              <Skeleton width={64} height={64} radius="full" />
                              <Skeleton width={52} height={10} />
                          </View>
                      ))
                    : items.map(item => (
                          <Pressable
                              key={item.id}
                              accessibilityRole="button"
                              accessibilityLabel={item.name}
                              onPress={() => router.push(`/collection/${item.slug}`)}
                              style={styles.item}
                          >
                              <View style={styles.tile}>
                                  {item.featuredAsset?.preview ? (
                                      <Image
                                          source={{uri: item.featuredAsset.preview}}
                                          style={styles.image}
                                          contentFit="cover"
                                          transition={140}
                                      />
                                  ) : (
                                      <IconSymbol name="chip" size={24} color="textMuted" />
                                  )}
                              </View>

                              <Text
                                  variant="micro"
                                  color="textMuted"
                                  numberOfLines={2}
                                  style={styles.label}
                              >
                                  {item.name}
                              </Text>
                          </Pressable>
                      ))}

                {showViewMore && !isLoading ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('viewAll')}
                        onPress={() => router.push('/shop')}
                        style={styles.item}
                    >
                        <View style={[styles.tile, styles.moreTile]}>
                            <IconSymbol name="grid" size={22} color="brand" />
                        </View>
                        <Text variant="micro" color="brand" numberOfLines={1} style={styles.label}>
                            {t('viewAll')}
                        </Text>
                    </Pressable>
                ) : null}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        paddingBottom: theme.spacing.md,
    },
    row: {
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.lg,
    },
    item: {
        width: 72,
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    tile: {
        width: 64,
        height: 64,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    moreTile: {
        backgroundColor: theme.colors.brandMuted,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    label: {
        textAlign: 'center',
    },
}));
