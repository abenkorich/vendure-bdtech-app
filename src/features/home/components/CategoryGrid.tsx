import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Skeleton} from '@/components/ui';
import {CollectionTile} from '@/features/collection/components/CollectionTile';
import type {CollectionTreeNode} from '@/lib/types';
import {SectionHeader} from './SectionHeader';
import {S} from '@/features/catalogue-strings';

/**
 * Top-collections grid.
 *
 * A plain two-column `flexWrap` rather than a nested list: the home screen is
 * already a scroll container, and a virtualized grid inside it would fight the
 * outer scroll for gestures and measure to zero height. There are ~10 top
 * collections, so there is nothing to virtualize anyway.
 */
export interface CategoryGridProps {
    collections?: readonly CollectionTreeNode[];
    isLoading?: boolean;
    /** Cap the number shown; the rest live on the Shop tab. */
    limit?: number;
}

export function CategoryGrid({collections, isLoading = false, limit = 6}: CategoryGridProps) {
    const items = (collections ?? []).slice(0, limit);

    if (!isLoading && items.length === 0) return null;

    return (
        <View style={styles.root}>
            <SectionHeader
                eyebrow={S.categoriesEyebrow}
                title={S.categoriesTitle}
                action={{label: S.viewAll, onPress: () => router.push('/shop')}}
            />

            <View style={styles.grid}>
                {isLoading
                    ? [0, 1, 2, 3].map(index => (
                          <View key={index} style={styles.cell}>
                              <Skeleton width="100%" height={128} radius="md" />
                          </View>
                      ))
                    : items.map(collection => (
                          <View key={collection.id} style={styles.cell}>
                              <CollectionTile
                                  name={collection.name}
                                  imageUrl={collection.featuredAsset?.preview}
                                  meta={
                                      collection.children && collection.children.length > 0
                                          ? `${collection.children.length} ${S.subCollections}`
                                          : undefined
                                  }
                                  onPress={() => router.push(`/collection/${collection.slug}`)}
                              />
                          </View>
                      ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {paddingVertical: theme.spacing.lg},
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
    },
    cell: {
        // Two columns: half the row minus half the gap. Expressed as a
        // percentage so it holds on every device width without measurement.
        width: '48%',
        flexGrow: 1,
    },
}));
