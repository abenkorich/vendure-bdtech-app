import {useQuery, keepPreviousData, type UseQueryResult} from '@tanstack/react-query';
import {query} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import {
    BlogPostsQuery,
    BlogRailQuery,
    BlogPostBySlugQuery,
    type BlogRailItem,
    type BlogPostDetail,
} from '@/lib/vendure/blog';

/**
 * Blog hooks.
 *
 * The blog documents live outside the gql.tada snapshot (the schema was not
 * introspected when `graphql-env.d.ts` was generated), so results are cast to
 * the hand-written interfaces `blog.ts` already declares. The contract test
 * covers the gap that cast opens: it runs these documents against the live API,
 * which is the only thing that would catch a field being renamed.
 */

/**
 * Probed live: `BlogPostListOptions` accepts skip/take/sort/filter plus
 * `tagSlug` and `categorySlug`. There is no `topic` input — `topic` is an
 * output field only, so filtering by it has to go through `categorySlug`.
 */
export interface BlogPostsParams {
    take?: number;
    skip?: number;
    categorySlug?: string;
    tagSlug?: string;
}

export interface BlogPostsResult {
    posts: BlogRailItem[];
    totalItems: number;
}

export function useBlogPosts(params: BlogPostsParams = {}): UseQueryResult<BlogPostsResult, Error> {
    const {take = 12, skip = 0, categorySlug, tagSlug} = params;

    return useQuery({
        queryKey: queryKeys.blogPosts({take, skip, categorySlug, tagSlug}),
        placeholderData: keepPreviousData,
        staleTime: 30 * 60 * 1000,
        queryFn: async ({signal}) => {
            const {data} = await query(
                BlogPostsQuery,
                {
                    options: {
                        take,
                        skip,
                        ...(categorySlug ? {categorySlug} : {}),
                        ...(tagSlug ? {tagSlug} : {}),
                    },
                },
                {signal},
            );
            const result = data as {blogPosts: {totalItems: number; items: BlogRailItem[]}};
            return {posts: result.blogPosts.items, totalItems: result.blogPosts.totalItems};
        },
    });
}

/** The curated home-screen blog rail (featured-first, server-ordered). */
export function useBlogRail(take = 6): UseQueryResult<BlogRailItem[], Error> {
    return useQuery({
        queryKey: queryKeys.blogRail({take}),
        staleTime: 30 * 60 * 1000,
        queryFn: async ({signal}) => {
            const {data} = await query(BlogRailQuery, {options: {take}}, {signal});
            return (data as {blogRail: BlogRailItem[]}).blogRail;
        },
    });
}

export function useBlogPost(slug: string | undefined): UseQueryResult<BlogPostDetail | null, Error> {
    return useQuery({
        queryKey: queryKeys.blogPost(slug ?? ''),
        enabled: Boolean(slug),
        staleTime: 30 * 60 * 1000,
        queryFn: async ({signal}) => {
            const {data} = await query(BlogPostBySlugQuery, {slug: slug as string}, {signal});
            return (data as {blogPost: BlogPostDetail | null}).blogPost ?? null;
        },
    });
}

export type {BlogRailItem, BlogPostDetail};
