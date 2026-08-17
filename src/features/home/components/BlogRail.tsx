import {useCallback} from 'react';
import {View} from 'react-native';
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {Image} from 'expo-image';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Card, Text, Skeleton} from '@/components/ui';
import type {BlogRailItem} from '@/features/blog/queries';
import {SectionHeader} from './SectionHeader';
import {S} from '@/features/catalogue-strings';

/**
 * Blog rail.
 *
 * Content, not commerce: no price, a wide 16:9 cover, and reading time as the
 * only metadata. It sits at the bottom of home because it is the section a
 * shopper reaches when they did not find what they came for.
 *
 * Cards link to `/blog/[slug]`. They were deliberately inert while the blog
 * routes belonged to another workstream and did not exist yet — a card that
 * looks tappable and does nothing is worse than one that does not invite the
 * tap. Those routes have since landed, so the link is live.
 */
export interface BlogRailProps {
    posts?: readonly BlogRailItem[];
    isLoading?: boolean;
    error?: Error | null;
}

export function BlogRail({posts, isLoading = false, error = null}: BlogRailProps) {
    const {theme} = useUnistyles();

    const renderItem = useCallback(
        ({item}: ListRenderItemInfo<BlogRailItem>) => (
            <Card
                padding="none"
                style={styles.card}
                accessibilityLabel={item.title}
                onPress={() => router.push(`/blog/${item.slug}`)}
            >
                <View style={styles.media}>
                    {item.coverImageUrl ? (
                        <Image
                            source={{uri: item.coverImageUrl}}
                            style={styles.image}
                            contentFit="cover"
                            transition={160}
                            accessibilityIgnoresInvertColors
                        />
                    ) : null}
                </View>
                <View style={styles.body}>
                    {item.topic ? (
                        <Text variant="micro" color="brand" uppercase numberOfLines={1}>
                            {item.topic}
                        </Text>
                    ) : null}
                    <Text variant="bodyStrong" numberOfLines={2}>
                        {item.title}
                    </Text>
                    <Text variant="micro" color="textMuted" tabular>
                        {`${item.readingTimeMinutes} ${S.blogMinRead}`}
                    </Text>
                </View>
            </Card>
        ),
        [],
    );

    // A failed blog rail must not take the storefront's home screen with it:
    // it is the least important section on the page, so it simply disappears.
    if (error) return null;
    if (!isLoading && (!posts || posts.length === 0)) return null;

    return (
        <View style={styles.root}>
            <SectionHeader eyebrow={S.blogEyebrow} title={S.blogTitle} />

            {isLoading ? (
                <View style={styles.skeletonRow}>
                    {[0, 1, 2].map(index => (
                        <View key={index} style={styles.card}>
                            <Skeleton width="100%" height={128} radius="md" />
                            <View style={styles.body}>
                                <Skeleton height={14} />
                                <Skeleton height={14} width="60%" />
                            </View>
                        </View>
                    ))}
                </View>
            ) : (
                <FlashList
                    horizontal
                    data={posts as BlogRailItem[]}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    showsHorizontalScrollIndicator={false}
                    ItemSeparatorComponent={Separator}
                    contentContainerStyle={{paddingHorizontal: theme.spacing.lg}}
                />
            )}
        </View>
    );
}

function Separator() {
    return <View style={styles.separator} />;
}

const styles = StyleSheet.create(theme => ({
    root: {paddingVertical: theme.spacing.lg},
    separator: {width: theme.spacing.md},
    skeletonRow: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        overflow: 'hidden',
    },
    card: {width: 240},
    media: {
        aspectRatio: 16 / 9,
        backgroundColor: theme.colors.surfaceElevated,
    },
    image: {width: '100%', height: '100%'},
    body: {padding: theme.spacing.md, gap: theme.spacing.xs},
}));
