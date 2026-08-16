/** Vendure's synthetic root collection — not a storefront route. */
const ROOT_COLLECTION_SLUG = '__root_collection__';

export type CollectionBreadcrumbCrumb = {
    id: string;
    name: string;
    slug: string;
};

/**
 * Returns the navigable collection hierarchy from Vendure's `collection.breadcrumbs`,
 * excluding the synthetic root. Falls back to a single crumb when breadcrumbs are empty.
 */
export function getCollectionBreadcrumbTrail(
    breadcrumbs: CollectionBreadcrumbCrumb[] | null | undefined,
    fallback?: Pick<CollectionBreadcrumbCrumb, 'name' | 'slug'> | null,
): CollectionBreadcrumbCrumb[] {
    const trail = (breadcrumbs ?? []).filter(
        crumb => crumb.slug !== ROOT_COLLECTION_SLUG,
    );

    if (trail.length > 0) {
        return trail;
    }

    if (fallback) {
        return [{id: fallback.slug, name: fallback.name, slug: fallback.slug}];
    }

    return [];
}
