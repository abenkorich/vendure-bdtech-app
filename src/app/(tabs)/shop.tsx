import {useCallback, useState} from 'react';
import {View, Pressable} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import Animated, {LinearTransition} from 'react-native-reanimated';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Screen, Text, Card, Skeleton, EmptyState, IconSymbol, Divider} from '@/components/ui';
import {useCollections} from '@/features/collection/queries';
import type {CollectionTreeNode} from '@/lib/types';
import {S} from '@/features/catalogue-strings';

/**
 * Shop — the collection tree.
 *
 * Accordion rather than a drill-down stack. A drill-down costs a screen
 * transition per level and hides the sibling categories, which is exactly the
 * context an electronics shopper needs ("is this under Sensors or under
 * Modules?"). Expanding in place keeps the whole map on one screen.
 *
 * A parent row does two things and must make both reachable: tapping the row
 * expands it, tapping "View all" opens the parent's own listing. Merging them
 * would make one of the two unreachable.
 */
export default function ShopScreen() {
    const {theme} = useUnistyles();
    const {data, isPending, error, refetch, isRefetching} = useCollections();
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const toggle = useCallback((id: string) => {
        setExpanded(current => ({...current, [id]: !current[id]}));
    }, []);

    const renderItem = useCallback(
        ({item}: {item: CollectionTreeNode}) => {
            const children = item.children ?? [];
            const isOpen = Boolean(expanded[item.id]);

            return (
                <Animated.View layout={LinearTransition.duration(theme.motion.base)}>
                    <Card padding="none" style={styles.group}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityState={{expanded: isOpen}}
                            accessibilityLabel={item.name}
                            onPress={() =>
                                children.length > 0
                                    ? toggle(item.id)
                                    : router.push(`/collection/${item.slug}`)
                            }
                            style={styles.groupHeader}
                        >
                            <View style={styles.groupText}>
                                <Text variant="bodyStrong" numberOfLines={1}>
                                    {item.name}
                                </Text>
                                {children.length > 0 ? (
                                    <Text variant="micro" color="textMuted" tabular>
                                        {`${children.length} ${S.subCollections}`}
                                    </Text>
                                ) : null}
                            </View>

                            <IconSymbol
                                name={
                                    children.length === 0
                                        ? 'chevronForward'
                                        : isOpen
                                          ? 'chevronUp'
                                          : 'chevronDown'
                                }
                                size={18}
                                color="textMuted"
                            />
                        </Pressable>

                        {isOpen && children.length > 0 ? (
                            <View style={styles.children}>
                                <Divider />
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() => router.push(`/collection/${item.slug}`)}
                                    style={styles.childRow}
                                >
                                    <Text variant="caption" color="brand">
                                        {S.viewCollection}
                                    </Text>
                                    <IconSymbol name="chevronForward" size={16} color="brand" />
                                </Pressable>

                                {children.map(child => (
                                    <View key={child.id}>
                                        <Divider />
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel={child.name}
                                            onPress={() => router.push(`/collection/${child.slug}`)}
                                            style={styles.childRow}
                                        >
                                            <Text variant="body" numberOfLines={1} style={styles.childName}>
                                                {child.name}
                                            </Text>
                                            <IconSymbol
                                                name="chevronForward"
                                                size={16}
                                                color="textMuted"
                                            />
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        ) : null}
                    </Card>
                </Animated.View>
            );
        },
        [expanded, toggle, theme.motion.base],
    );

    return (
        <Screen>
            <View style={styles.header}>
                <Text variant="title">{S.collectionsTitle}</Text>
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
                <View style={styles.skeletons}>
                    {[0, 1, 2, 3, 4, 5].map(index => (
                        <Skeleton key={index} height={64} radius="md" />
                    ))}
                </View>
            ) : (data?.length ?? 0) === 0 ? (
                <EmptyState title={S.collectionsEmpty} />
            ) : (
                <FlashList
                    data={data as CollectionTreeNode[]}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    refreshing={isRefetching}
                    onRefresh={() => void refetch()}
                    ItemSeparatorComponent={Gap}
                    contentContainerStyle={{
                        paddingHorizontal: theme.spacing.lg,
                        paddingBottom: theme.spacing['3xl'],
                    }}
                />
            )}
        </Screen>
    );
}

function Gap() {
    return <View style={styles.gap} />;
}

const styles = StyleSheet.create(theme => ({
    header: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.md,
    },
    skeletons: {
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    gap: {height: theme.spacing.md},
    group: {overflow: 'hidden'},
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
        // 44pt minimum target, met by padding rather than a fixed height so a
        // two-line category name still fits.
        minHeight: 56,
    },
    groupText: {flex: 1, gap: 2},
    children: {
        backgroundColor: theme.colors.surfaceElevated,
    },
    childRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
        // Logical: the extra indent must sit on the reading-start side so the
        // hierarchy still reads as nesting in Arabic.
        paddingStart: theme.spacing.xl,
        paddingEnd: theme.spacing.lg,
        minHeight: 44,
    },
    childName: {flex: 1},
}));
