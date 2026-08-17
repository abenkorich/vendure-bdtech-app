import {View} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Card, Badge, Skeleton} from '@/components/ui';
import type {BlogRailItem} from '@/features/blog/queries';
import {translate} from '@/features/account/i18n';
import {formatDate} from '@/lib/format';
import {deviceLocale} from '@/design/locale';

/**
 * Blog index card.
 *
 * Wide 16:9 cover, topic, title, excerpt, then date and read time on one
 * metadata line. No price and no CTA button: this is content, and a card that
 * looks like a product card invites a "buy" read of an article.
 */
export function PostCard({post, onPress}: {post: BlogRailItem; onPress: () => void}) {
    const minRead = translate('HomeSections.blog.minRead');
    const date = formatDate(post.publishedAt, 'short', deviceLocale());

    return (
        <Card padding="none" style={styles.card} onPress={onPress} accessibilityLabel={post.title}>
            <View style={styles.media}>
                {post.coverImageUrl ? (
                    <Image
                        source={{uri: post.coverImageUrl}}
                        style={styles.image}
                        contentFit="cover"
                        transition={160}
                        accessibilityIgnoresInvertColors
                    />
                ) : null}
                {post.featured ? (
                    <View style={styles.featured}>
                        <Badge tone="brand" solid>
                            {translate('HomeSections.blog.eyebrow')}
                        </Badge>
                    </View>
                ) : null}
            </View>

            <View style={styles.body}>
                {post.topic ? (
                    <Text variant="micro" color="brand" uppercase numberOfLines={1}>
                        {post.topic}
                    </Text>
                ) : null}

                <Text variant="heading" numberOfLines={2}>
                    {post.title}
                </Text>

                {post.excerpt ? (
                    <Text variant="caption" color="textMuted" numberOfLines={3}>
                        {post.excerpt}
                    </Text>
                ) : null}

                <View style={styles.meta}>
                    {post.authorName ? (
                        <Text variant="micro" color="textMuted" numberOfLines={1} style={styles.author}>
                            {post.authorName}
                        </Text>
                    ) : null}
                    {date ? (
                        <Text variant="micro" color="textMuted" tabular>
                            {date}
                        </Text>
                    ) : null}
                    <Text variant="micro" color="textMuted" tabular>
                        {`${post.readingTimeMinutes} ${minRead}`}
                    </Text>
                </View>
            </View>
        </Card>
    );
}

export function PostCardSkeleton() {
    return (
        <View style={styles.card}>
            <Skeleton width="100%" height={180} radius="lg" />
            <View style={styles.body}>
                <Skeleton height={18} width="80%" />
                <Skeleton height={14} />
                <Skeleton height={14} width="55%" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    card: {overflow: 'hidden'},
    media: {
        aspectRatio: 16 / 9,
        backgroundColor: theme.colors.surfaceElevated,
    },
    image: {width: '100%', height: '100%'},
    featured: {
        position: 'absolute',
        top: theme.spacing.sm,
        // Logical inset so the badge sits on the leading edge in Arabic too.
        insetInlineStart: theme.spacing.sm,
    },
    body: {padding: theme.spacing.md, gap: theme.spacing.xs},
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingTop: theme.spacing.xs,
    },
    author: {flexShrink: 1},
}));
