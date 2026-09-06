/**
 * The pure half of the "Explore more" feed.
 *
 * The feed pages through several collections at once, newest products first,
 * and keeps going as long as any of them has more. Two facts shape it:
 *
 * - The search index has no date sort, but within a collection it returns
 *   products in creation order (measured live: ids 10, 32, 44 … 6571 for a
 *   453-product collection, and the newest catalogue ids are the highest). So
 *   "newest first" is reading each collection *from the end*: page 0 is the
 *   last `per` items, page 1 the `per` before those, and so on.
 * - Collections are interleaved round-robin so a small one is not buried
 *   under a large one, and a product filed under two of them appears once.
 */

export interface PageWindow {
    slug: string;
    skip: number;
    take: number;
}

/** Products per page, across all collections. */
export const FEED_PAGE_SIZE = 12;
/** Collections a feed draws from at most; more than this dilutes each. */
export const FEED_MAX_COLLECTIONS = 4;

/** How many of each collection's products one page takes. */
export function perCollection(collectionCount: number, pageSize = FEED_PAGE_SIZE): number {
    return Math.max(1, Math.ceil(pageSize / Math.max(1, Math.min(collectionCount, FEED_MAX_COLLECTIONS))));
}

/**
 * The slice of each collection that page `index` should read, walking back
 * from the end. A collection that is exhausted yields no window.
 */
export function pageWindows(
    totals: ReadonlyArray<{slug: string; total: number}>,
    index: number,
    per: number,
): PageWindow[] {
    const windows: PageWindow[] = [];
    for (const {slug, total} of totals) {
        const end = total - index * per;
        if (end <= 0) continue;
        const start = Math.max(0, end - per);
        windows.push({slug, skip: start, take: end - start});
    }
    return windows;
}

/** Whether any collection still has products beyond page `index`. */
export function hasMorePages(
    totals: ReadonlyArray<{slug: string; total: number}>,
    index: number,
    per: number,
): boolean {
    return totals.some(({total}) => total - (index + 1) * per > 0);
}

/**
 * Round-robin merge of per-collection lists (each already newest first),
 * de-duplicated by key so a product in two collections shows once.
 */
export function interleave<T>(lists: ReadonlyArray<readonly T[]>, key: (item: T) => string): T[] {
    const out: T[] = [];
    const seen = new Set<string>();
    const longest = Math.max(0, ...lists.map(list => list.length));
    for (let i = 0; i < longest; i += 1) {
        for (const list of lists) {
            const item = list[i];
            if (item === undefined) continue;
            const id = key(item);
            if (seen.has(id)) continue;
            seen.add(id);
            out.push(item);
        }
    }
    return out;
}
