import {FlatList, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useRouter} from 'expo-router';
import {Screen, EmptyState} from '@/components/ui';
import {BackHeader} from '@/features/account/components/chrome';
import {useBlogPosts} from '@/features/blog/queries';
import {PostCard, PostCardSkeleton} from '@/features/blog/components/PostCard';
import {useT, translate} from '@/features/account/i18n';

/**
 * Blog index.
 *
 * A single column of wide cards rather than the two-column grid the tools hub
 * uses: an article is chosen by its headline and cover, both of which need
 * width, where a calculator is chosen by its name alone.
 */
export default function BlogScreen() {
    const t = useT('HomeSections.blog');
    const router = useRouter();
    const posts = useBlogPosts({take: 24});

    return (
        <Screen>
            <BackHeader title={t('title')} subtitle={t('subtitle')} />

            {posts.isPending ? (
                <View style={styles.list}>
                    <PostCardSkeleton />
                    <PostCardSkeleton />
                </View>
            ) : posts.error ? (
                <EmptyState
                    tone="error"
                    title={translate('Errors.somethingWentWrong')}
                    message={posts.error.message}
                    action={{
                        label: translate('Common.restartNow'),
                        onPress: () => void posts.refetch(),
                    }}
                />
            ) : (posts.data?.posts.length ?? 0) === 0 ? (
                <EmptyState
                    icon="article"
                    title={t('title')}
                    message={t('subtitle')}
                    action={{
                        label: translate('NotFound.browseProducts'),
                        onPress: () => router.push('/(tabs)/shop'),
                    }}
                />
            ) : (
                <FlatList
                    data={posts.data?.posts ?? []}
                    keyExtractor={post => post.id}
                    contentContainerStyle={styles.list}
                    refreshing={posts.isRefetching}
                    onRefresh={() => void posts.refetch()}
                    renderItem={({item}) => (
                        <PostCard post={item} onPress={() => router.push(`/blog/${item.slug}`)} />
                    )}
                />
            )}
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    list: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'],
        gap: theme.spacing.lg,
    },
}));
