import type {PriceFilter} from '@/lib/search-helpers';

/**
 * Pure price predicates, split out of `price-filter.ts`.
 *
 * Why the split: `price-filter.ts` imports the API client, which reaches
 * `lib/env.ts` -> expo-constants -> react-native. React Native cannot be
 * bundled for Node, so anything importing it is untestable in the harness.
 * These four functions carry the actual filtering logic and no I/O, so they
 * live here and `price-filter.ts` re-exports them: call sites are unchanged
 * and the logic becomes testable.
 *
 * All values are in **minor units** (centimes for DZD).
 */

/**
 * `PriceRange | SinglePrice` flattened into one optional shape. A discriminated
 * union would be more precise, but the generated gql.tada types already model
 * that and callers only need the numeric span, so this stays structural.
 */
export type PriceValue = {min?: number; max?: number; value?: number; __typename?: string};

/** Lowest price a result can be bought at, in minor units. */
export function lowestPrice(price: PriceValue): number {
    if (typeof price?.min === 'number') return price.min;
    return typeof price?.value === 'number' ? price.value : 0;
}

/** Highest price a result can be bought at, in minor units. */
export function highestPrice(price: PriceValue): number {
    if (typeof price?.max === 'number') return price.max;
    return typeof price?.value === 'number' ? price.value : 0;
}

/**
 * A product matches when its price span overlaps the selected window, so a
 * variant-priced product stays visible if *any* variant falls inside it.
 */
export function matchesPriceFilter(price: PriceValue, filter: PriceFilter): boolean {
    const min = filter.min ?? Number.NEGATIVE_INFINITY;
    const max = filter.max ?? Number.POSITIVE_INFINITY;
    return highestPrice(price) >= min && lowestPrice(price) <= max;
}
