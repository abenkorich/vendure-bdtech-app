/**
 * The pure half of recent searches.
 *
 * Split from `recent-searches.ts` because that file imports MMKV, and
 * `tests/run.mjs` bundles for Node where anything reaching React Native fails
 * to build (see AGENTS.md). The de-duplication rule is the part worth testing,
 * so it lives where a test can reach it.
 */

/** How many terms the chip row keeps. */
export const RECENT_LIMIT = 8;

/** Longer than this is a paste, not a search, and would wreck the chip row. */
const MAX_TERM_LENGTH = 60;

/**
 * Case-insensitive de-duplication, most recent first.
 *
 * "esp32" typed after "ESP32" must *move* the existing entry rather than sit
 * beside a near-duplicate chip.
 */
export function mergeRecent(
    list: readonly string[],
    term: string,
    limit = RECENT_LIMIT,
): string[] {
    const trimmed = term.trim().slice(0, MAX_TERM_LENGTH);
    if (!trimmed) return [...list];
    const folded = trimmed.toLocaleLowerCase();
    const kept = list.filter(item => item.trim().toLocaleLowerCase() !== folded);
    return [trimmed, ...kept].slice(0, limit);
}
