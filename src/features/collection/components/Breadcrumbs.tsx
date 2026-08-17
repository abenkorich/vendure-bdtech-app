import {View, Pressable, ScrollView} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Text, IconSymbol} from '@/components/ui';

/**
 * Breadcrumbs.
 *
 * Horizontally scrollable rather than wrapped: a deep electronics taxonomy
 * ("Components › Semiconductors › Transistors › MOSFETs") wraps to three lines
 * on a phone and pushes the grid below the fold.
 *
 * Vendure's `breadcrumbs` includes the synthetic root `__root_collection__`,
 * which is not a navigable page; it is dropped here rather than at every call
 * site.
 */
export interface BreadcrumbItem {
    id: string;
    name: string;
    slug: string;
}

export interface BreadcrumbsProps {
    items: readonly BreadcrumbItem[];
}

const ROOT_SLUG = '__root_collection__';

export function Breadcrumbs({items}: BreadcrumbsProps) {
    const trail = items.filter(item => item.slug !== ROOT_SLUG);
    // The last crumb is the current page, so it is not a link.
    if (trail.length <= 1) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
        >
            {trail.map((item, index) => {
                const isLast = index === trail.length - 1;
                return (
                    <View key={item.id} style={styles.crumb}>
                        {index > 0 ? (
                            <IconSymbol name="chevronForward" size={12} color="textMuted" />
                        ) : null}
                        {isLast ? (
                            <Text variant="micro" color="textMuted" numberOfLines={1}>
                                {item.name}
                            </Text>
                        ) : (
                            <Pressable
                                accessibilityRole="link"
                                hitSlop={8}
                                onPress={() => router.push(`/collection/${item.slug}`)}
                            >
                                <Text variant="micro" color="brand" numberOfLines={1}>
                                    {item.name}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create(theme => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.lg,
    },
    crumb: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
}));
