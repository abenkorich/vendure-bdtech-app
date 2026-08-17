import type {SearchFacetValue} from '@/lib/types';

/**
 * Filter state and the pure logic around it.
 *
 * Kept free of React and of React Native so the parts most likely to be wrong —
 * the active-filter count, facet grouping, suggestion generation — are unit
 * testable in Node. (`tests/run.mjs` cannot bundle React Native; see AGENTS.md.)
 */

export type SortKey = 'relevance' | 'price-asc' | 'price-desc' | 'name-asc';

export const SORT_OPTIONS: readonly SortKey[] = [
    'relevance',
    'price-asc',
    'price-desc',
    'name-asc',
] as const;

/** Message key under the `Sort` namespace for each option. */
export const SORT_MESSAGE_KEY: Record<SortKey, string> = {
    relevance: 'relevance',
    'price-asc': 'priceAsc',
    'price-desc': 'priceDesc',
    'name-asc': 'nameAsc',
};

/**
 * Vendure's `SearchInput.sort` has no "relevance" member: relevance *is* the
 * order the search index returns when no sort is given. `buildSearchInput`
 * defaults an unknown key to `name-asc`, so relevance has to be expressed as
 * "send nothing sortable", which the screen does by omitting `sort` entirely.
 */
export function sortParam(sort: SortKey): string | undefined {
    return sort === 'relevance' ? undefined : sort;
}

export interface FilterState {
    facetValueIds: string[];
    /** Minor units. `null` on either end means "unbounded on that side". */
    minPrice: number | null;
    maxPrice: number | null;
    inStockOnly: boolean;
    sort: SortKey;
}

export const EMPTY_FILTERS: FilterState = {
    facetValueIds: [],
    minPrice: null,
    maxPrice: null,
    inStockOnly: false,
    sort: 'relevance',
};

/**
 * Badge number on the filter trigger.
 *
 * Sort is excluded on purpose: it is always set to *something*, so counting it
 * would mean the badge never reads zero and stops meaning "you have narrowed
 * this".  A price window counts as one regardless of how many ends are set.
 */
export function activeFilterCount(state: FilterState): number {
    let count = state.facetValueIds.length;
    if (state.minPrice !== null || state.maxPrice !== null) count += 1;
    if (state.inStockOnly) count += 1;
    return count;
}

export function hasActiveFilters(state: FilterState): boolean {
    return activeFilterCount(state) > 0 || state.sort !== EMPTY_FILTERS.sort;
}

export function toggleFacetValue(state: FilterState, id: string): FilterState {
    const selected = state.facetValueIds.includes(id);
    return {
        ...state,
        facetValueIds: selected
            ? state.facetValueIds.filter(existing => existing !== id)
            : [...state.facetValueIds, id],
    };
}

/** A price window only exists when at least one end is set. */
export function priceFilterOf(state: FilterState): {min?: number; max?: number} | null {
    if (state.minPrice === null && state.maxPrice === null) return null;
    return {
        ...(state.minPrice !== null ? {min: state.minPrice} : {}),
        ...(state.maxPrice !== null ? {max: state.maxPrice} : {}),
    };
}

// --- facets -------------------------------------------------------------

export interface FacetGroup {
    id: string;
    name: string;
    values: {id: string; name: string; count: number}[];
}

/**
 * Groups the flat `facetValues` the search returns by their parent facet
 * (brand, category, ...), preserving server order within a group.
 *
 * Groups with a single value are dropped: a filter that every result already
 * matches narrows nothing and only adds a row to scroll past.
 */
export function groupFacets(facetValues: readonly SearchFacetValue[]): FacetGroup[] {
    const groups = new Map<string, FacetGroup>();

    for (const entry of facetValues) {
        const value = entry?.facetValue;
        const facet = value?.facet;
        if (!value || !facet) continue;

        let group = groups.get(facet.id);
        if (!group) {
            group = {id: facet.id, name: facet.name, values: []};
            groups.set(facet.id, group);
        }
        group.values.push({id: value.id, name: value.name, count: entry.count ?? 0});
    }

    return [...groups.values()].filter(group => group.values.length > 1);
}

// --- suggestions --------------------------------------------------------

/**
 * Fallback terms for the "no results" state.
 *
 * These are catalogue-shaped, not generic: this is an electronics parts store,
 * and a shopper who mistyped "arduini" is far better served by "arduino" than
 * by a shrug. Deliberately not translated — they are product/brand names, which
 * are the same string in all three locales.
 */
export const SUGGESTED_TERMS: readonly string[] = [
    'arduino',
    'esp32',
    'raspberry pi',
    'capteur',
    'resistor',
    'lcd',
    'servo',
    'relay',
];

/**
 * Suggestions for a failed search: anything sharing a prefix with what was
 * typed first (so "ardui" surfaces "arduino" at the top), then the rest, minus
 * the term itself.
 */
export function suggestionsFor(term: string, limit = 6): string[] {
    const folded = term.trim().toLocaleLowerCase();
    const pool = SUGGESTED_TERMS.filter(item => item !== folded);
    if (!folded) return pool.slice(0, limit);

    const head = folded.slice(0, 3);
    const related = pool.filter(item => item.startsWith(head));
    const rest = pool.filter(item => !item.startsWith(head));
    return [...related, ...rest].slice(0, limit);
}
