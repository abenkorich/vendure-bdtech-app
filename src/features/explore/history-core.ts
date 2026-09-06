/**
 * The pure half of browsing history: which collections this device has
 * visited, and which of them matter most right now.
 *
 * Split from the MMKV binding for the same reason as `search/recent-core.ts`:
 * the ranking rule is the part worth a test, and tests cannot import React
 * Native.
 */

export interface CollectionVisit {
    slug: string;
    /** Visits, capped so one binge cannot pin a collection forever. */
    count: number;
    /** Epoch ms of the latest visit. */
    lastVisit: number;
}

/** Collections remembered per device. */
export const HISTORY_LIMIT = 20;
/** Visits counted per collection; beyond this only recency moves the score. */
export const COUNT_CAP = 20;
/**
 * Half-life of a visit's weight, in days. A week: ten visits a month ago
 * (≈0.5) lose to two visits yesterday (≈1.8), which is what "what I'm into
 * now" should mean for a shop.
 */
export const HALF_LIFE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Record a visit, most recent first, dropping the oldest beyond the limit. */
export function recordVisit(
    history: readonly CollectionVisit[],
    slug: string,
    now = Date.now(),
): CollectionVisit[] {
    const trimmed = slug.trim();
    if (!trimmed) return [...history];

    const existing = history.find(entry => entry.slug === trimmed);
    const updated: CollectionVisit = {
        slug: trimmed,
        count: Math.min(COUNT_CAP, (existing?.count ?? 0) + 1),
        lastVisit: now,
    };
    const rest = history.filter(entry => entry.slug !== trimmed);
    return [updated, ...rest].slice(0, HISTORY_LIMIT);
}

/**
 * Score: visits weighted by how recently the last one happened, halving every
 * `HALF_LIFE_DAYS`. A collection browsed ten times a month ago ranks below one
 * browsed twice yesterday, which is what "what I'm into now" means.
 */
export function visitScore(entry: CollectionVisit, now = Date.now()): number {
    const ageDays = Math.max(0, now - entry.lastVisit) / DAY_MS;
    return entry.count * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/** The collections to build a feed from, best first. */
export function rankVisited(
    history: readonly CollectionVisit[],
    limit: number,
    now = Date.now(),
): string[] {
    return [...history]
        .sort((a, b) => visitScore(b, now) - visitScore(a, now))
        .slice(0, limit)
        .map(entry => entry.slug);
}

/** Parse a persisted blob, dropping anything that is not a visit. */
export function parseHistory(raw: unknown): CollectionVisit[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
        (entry): entry is CollectionVisit =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as CollectionVisit).slug === 'string' &&
            typeof (entry as CollectionVisit).count === 'number' &&
            typeof (entry as CollectionVisit).lastVisit === 'number',
    );
}
