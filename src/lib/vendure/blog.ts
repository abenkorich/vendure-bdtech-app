import {graphql} from '@/graphql';

/**
 * Temporary loose graphql helper until the Shop API blog schema
 * is deployed and `graphql-env.d.ts` is regenerated.
 */
const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

export const BlogRailQuery = graphqlUnsafe(`
    query BlogRail($options: BlogRailOptions) {
        blogRail(options: $options) {
            id
            slug
            title
            excerpt
            coverImageUrl
            topic
            publishedAt
            readingTimeMinutes
            featured
            authorName
        }
    }
`);

export const BlogPostsQuery = graphqlUnsafe(`
    query BlogPosts($options: BlogPostListOptions) {
        blogPosts(options: $options) {
            totalItems
            items {
                id
                slug
                title
                excerpt
                coverImageUrl
                topic
                publishedAt
                readingTimeMinutes
                authorName
            }
        }
    }
`);

export const BlogPostBySlugQuery = graphqlUnsafe(`
    query BlogPostBySlug($slug: String!) {
        blogPost(slug: $slug) {
            id
            slug
            title
            excerpt
            body
            blocks
            coverImageUrl
            topic
            publishedAt
            readingTimeMinutes
            authorName
            author {
                id
                slug
                name
                bio
                avatarUrl
            }
            seoTitle
            seoDescription
            ogImageUrl
            canonicalPath
            noIndex
            relatedProducts {
                id
                name
                slug
                featuredAsset {
                    preview
                }
            }
            tags {
                id
                slug
                name
            }
        }
    }
`);

export interface BlogRailItem {
    id: string;
    slug: string;
    title: string;
    excerpt?: string | null;
    coverImageUrl?: string | null;
    topic?: string | null;
    publishedAt?: string | null;
    readingTimeMinutes: number;
    featured: boolean;
    authorName?: string | null;
}

export interface BlogPostDetail extends BlogRailItem {
    body?: string | null;
    blocks?: unknown;
    seoTitle?: string | null;
    seoDescription?: string | null;
    ogImageUrl?: string | null;
    canonicalPath?: string | null;
    noIndex?: boolean;
    author?: {
        id: string;
        slug: string;
        name: string;
        bio?: string | null;
        avatarUrl?: string | null;
    } | null;
    relatedProducts?: Array<{
        id: string;
        name: string;
        slug: string;
        featuredAsset?: {preview: string} | null;
    }>;
    tags?: Array<{id: string; slug: string; name: string}>;
}
