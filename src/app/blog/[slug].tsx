import {ScrollView, View} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {Screen, Text, Badge, Skeleton, EmptyState, Divider, Card} from '@/components/ui';
import {BackHeader} from '@/features/account/components/chrome';
import {useBlogPost} from '@/features/blog/queries';
import {PostBody} from '@/features/blog/components/PostBody';
import {htmlToPlainText} from '@/features/blog/html';
import {translate} from '@/features/account/i18n';
import {formatDate} from '@/lib/format';
import {deviceLocale} from '@/design/locale';

/**
 * Post detail.
 *
 * The body is HTML from the CMS, rendered natively (see `blog/html.ts` for why
 * there is no WebView). Everything below the body — author, tags, related
 * products — is optional in the schema and each section simply disappears when
 * absent, rather than rendering an empty labelled block.
 */
export default function BlogPostScreen() {
    const {slug} = useLocalSearchParams<{slug: string}>();
    const router = useRouter();
    const post = useBlogPost(slug);

    const minRead = translate('HomeSections.blog.minRead');

    if (post.isPending) {
        return (
            <Screen>
                <BackHeader title={translate('HomeSections.blog.title')} />
                <View style={styles.content}>
                    <Skeleton width="100%" height={200} radius="lg" />
                    <Skeleton height={24} width="85%" />
                    <Skeleton height={16} />
                    <Skeleton height={16} />
                    <Skeleton height={16} width="60%" />
                </View>
            </Screen>
        );
    }

    if (post.error || !post.data) {
        return (
            <Screen>
                <BackHeader title={translate('HomeSections.blog.title')} />
                <EmptyState
                    tone={post.error ? 'error' : 'neutral'}
                    icon="article"
                    title={translate('NotFound.title')}
                    message={post.error?.message ?? translate('NotFound.message')}
                    action={{
                        label: translate('NotFound.goHome'),
                        onPress: () => router.replace('/blog'),
                    }}
                />
            </Screen>
        );
    }

    const data = post.data;
    const date = formatDate(data.publishedAt, 'long', deviceLocale());
    // The API's excerpt is authoritative; the body is only mined for one when
    // an editor left it blank, so a post never opens with just a headline.
    const excerpt = data.excerpt ?? htmlToPlainText(data.body, 180);

    return (
        <Screen>
            <BackHeader title={translate('HomeSections.blog.title')} />
            <ScrollView contentContainerStyle={styles.content}>
                {data.coverImageUrl ? (
                    <Image
                        source={{uri: data.coverImageUrl}}
                        style={styles.cover}
                        contentFit="cover"
                        transition={200}
                        accessibilityIgnoresInvertColors
                    />
                ) : null}

                {data.topic ? (
                    <Text variant="micro" color="brand" uppercase>
                        {data.topic}
                    </Text>
                ) : null}

                <Text variant="display">{data.title}</Text>

                <View style={styles.meta}>
                    {data.authorName ? (
                        <Text variant="caption" color="textMuted" numberOfLines={1}>
                            {data.authorName}
                        </Text>
                    ) : null}
                    {date ? (
                        <Text variant="caption" color="textMuted" tabular>
                            {date}
                        </Text>
                    ) : null}
                    <Text variant="caption" color="textMuted" tabular>
                        {`${data.readingTimeMinutes} ${minRead}`}
                    </Text>
                </View>

                {excerpt ? (
                    <Text variant="bodyStrong" color="textMuted">
                        {excerpt}
                    </Text>
                ) : null}

                <Divider />

                <PostBody html={data.body} />

                {data.tags && data.tags.length > 0 ? (
                    <View style={styles.tags}>
                        {data.tags.map(tag => (
                            <Badge key={tag.id} tone="neutral">
                                {tag.name}
                            </Badge>
                        ))}
                    </View>
                ) : null}

                {data.author?.bio ? (
                    <Card padding="md" style={styles.author}>
                        <Text variant="bodyStrong">{data.author.name}</Text>
                        <Text variant="caption" color="textMuted">
                            {data.author.bio}
                        </Text>
                    </Card>
                ) : null}

                {data.relatedProducts && data.relatedProducts.length > 0 ? (
                    <View style={styles.related}>
                        <Text variant="heading">{translate('Product.relatedProducts')}</Text>
                        {data.relatedProducts.map(product => (
                            <Card
                                key={product.id}
                                padding="md"
                                style={styles.relatedRow}
                                onPress={() => router.push(`/product/${product.slug}`)}
                                accessibilityLabel={product.name}
                            >
                                {product.featuredAsset?.preview ? (
                                    <Image
                                        source={{uri: product.featuredAsset.preview}}
                                        style={styles.relatedImage}
                                        contentFit="cover"
                                        accessibilityIgnoresInvertColors
                                    />
                                ) : null}
                                <Text variant="bodyStrong" numberOfLines={2} style={styles.relatedName}>
                                    {product.name}
                                </Text>
                            </Card>
                        ))}
                    </View>
                ) : null}
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'],
        gap: theme.spacing.md,
    },
    cover: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surfaceElevated,
    },
    meta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.xs,
        paddingTop: theme.spacing.md,
    },
    author: {gap: theme.spacing.xs},
    related: {gap: theme.spacing.sm, paddingTop: theme.spacing.md},
    relatedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    relatedImage: {
        width: 56,
        height: 56,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surfaceElevated,
    },
    relatedName: {flex: 1},
}));
