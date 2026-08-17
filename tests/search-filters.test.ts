import {
    EMPTY_FILTERS,
    activeFilterCount,
    hasActiveFilters,
    groupFacets,
    priceFilterOf,
    sortParam,
    suggestionsFor,
    toggleFacetValue,
} from '@/features/search/filter-state';
// Import the pure core, not the hook module: recent-searches pulls in MMKV
// and therefore react-native, which cannot be bundled for Node.
import {mergeRecent} from '@/features/search/recent-core';
import {matchesPriceFilter} from '@/lib/price-predicates';
import {check, eq, done} from './harness';

/**
 * Search's pure logic: the filter badge, facet grouping, suggestions and the
 * recent-search list.
 *
 * Nothing here imports React Native (see AGENTS.md) — `filter-state.ts` and the
 * `mergeRecent` helper are kept free of it precisely so the parts most likely
 * to be wrong are testable in Node. Rendering is verified on the simulator.
 *
 * Run with: node tests/run.mjs search
 */

// --- active filter count -------------------------------------------------

eq('no filters counts zero', activeFilterCount(EMPTY_FILTERS), 0);

eq(
    'each facet value counts once',
    activeFilterCount({...EMPTY_FILTERS, facetValueIds: ['1', '2', '3']}),
    3,
);

eq(
    'a one-sided price window counts once',
    activeFilterCount({...EMPTY_FILTERS, minPrice: 500}),
    1,
);

eq(
    'a two-sided price window still counts once',
    activeFilterCount({...EMPTY_FILTERS, minPrice: 500, maxPrice: 9000}),
    1,
);

eq('in-stock counts once', activeFilterCount({...EMPTY_FILTERS, inStockOnly: true}), 1);

eq(
    'combined',
    activeFilterCount({
        ...EMPTY_FILTERS,
        facetValueIds: ['1', '2'],
        minPrice: 100,
        inStockOnly: true,
    }),
    4,
);

// Sort is always set to *something*, so counting it would mean the badge never
// reads zero and stops meaning "you have narrowed this".
eq(
    'sort does not contribute to the badge',
    activeFilterCount({...EMPTY_FILTERS, sort: 'price-desc'}),
    0,
);
check(
    'but sort does count as "not pristine"',
    hasActiveFilters({...EMPTY_FILTERS, sort: 'price-desc'}),
);
check('pristine state has no active filters', !hasActiveFilters(EMPTY_FILTERS));

// --- toggling ------------------------------------------------------------

eq(
    'toggle adds an unselected facet',
    toggleFacetValue(EMPTY_FILTERS, 'f1').facetValueIds.join(),
    'f1',
);
eq(
    'toggle removes a selected facet',
    toggleFacetValue({...EMPTY_FILTERS, facetValueIds: ['f1', 'f2']}, 'f1').facetValueIds.join(),
    'f2',
);

// --- price window --------------------------------------------------------

eq('no price window when both ends are null', priceFilterOf(EMPTY_FILTERS), null);
eq(
    'a min-only window omits max entirely',
    JSON.stringify(priceFilterOf({...EMPTY_FILTERS, minPrice: 1000})),
    '{"min":1000}',
);

// The screen feeds `priceFilterOf` straight into the shared matcher, so the
// two agreeing matters more than either being right alone.
check(
    'a product priced inside the window matches',
    matchesPriceFilter({__typename: 'SinglePrice', value: 5000}, priceFilterOf({
        ...EMPTY_FILTERS,
        minPrice: 1000,
        maxPrice: 9000,
    })!),
);
check(
    'a product priced above the window does not',
    !matchesPriceFilter({__typename: 'SinglePrice', value: 12000}, priceFilterOf({
        ...EMPTY_FILTERS,
        minPrice: 1000,
        maxPrice: 9000,
    })!),
);
check(
    'a variant range overlapping the window matches',
    matchesPriceFilter({__typename: 'PriceRange', min: 200, max: 20000}, priceFilterOf({
        ...EMPTY_FILTERS,
        minPrice: 1000,
        maxPrice: 9000,
    })!),
);

// --- sort ----------------------------------------------------------------

// Vendure's SearchInput has no "relevance" sort: relevance is what the index
// returns when no sort is given, so it must serialise to nothing at all.
eq('relevance sends no sort param', sortParam('relevance'), undefined);
eq('price-asc passes through', sortParam('price-asc'), 'price-asc');
eq('name-asc passes through', sortParam('name-asc'), 'name-asc');

// --- facet grouping ------------------------------------------------------

const brand = {id: 'facet-brand', name: 'Brand'};
const category = {id: 'facet-category', name: 'Category'};

const facetValues = [
    {count: 12, facetValue: {id: 'b1', name: 'Espressif', facet: brand}},
    {count: 4, facetValue: {id: 'b2', name: 'Arduino', facet: brand}},
    {count: 7, facetValue: {id: 'c1', name: 'Boards', facet: category}},
    {count: 3, facetValue: {id: 'c2', name: 'Sensors', facet: category}},
] as never;

const grouped = groupFacets(facetValues);
eq('two facets produce two groups', grouped.length, 2);
eq('groups keep the facet name', grouped[0].name, 'Brand');
eq('values stay in server order', grouped[0].values.map(v => v.name).join(), 'Espressif,Arduino');
eq('counts survive grouping', grouped[0].values[0].count, 12);

// A filter every result already matches narrows nothing and only adds a row.
eq(
    'a single-value group is dropped',
    groupFacets([{count: 9, facetValue: {id: 'b1', name: 'Espressif', facet: brand}}] as never).length,
    0,
);

eq(
    'a facetValue with no parent facet is skipped rather than crashing',
    groupFacets([{count: 1, facetValue: null}] as never).length,
    0,
);

// --- suggestions ---------------------------------------------------------

check('a mistyped term surfaces its prefix match first', suggestionsFor('ardui')[0] === 'arduino');
check('suggestions never echo the term back', !suggestionsFor('esp32').includes('esp32'));
check('an empty term still suggests something', suggestionsFor('').length > 0);
eq('suggestions respect the limit', suggestionsFor('xyz', 3).length, 3);

// --- recent searches -----------------------------------------------------

eq('a term is prepended', mergeRecent(['a'], 'esp32').join(), 'esp32,a');
eq('whitespace-only is ignored', mergeRecent(['a'], '   ').join(), 'a');
eq('the term is trimmed', mergeRecent([], '  esp32  ').join(), 'esp32');

// "esp32" typed after "ESP32" must *move* the existing entry, not sit beside a
// near-duplicate chip.
eq(
    'de-duplication is case-insensitive and moves the entry',
    mergeRecent(['ESP32', 'arduino'], 'esp32').join(),
    'esp32,arduino',
);

eq(
    'the list is capped',
    mergeRecent(['1', '2', '3', '4', '5', '6', '7', '8'], 'new').length,
    8,
);
eq(
    'capping drops the oldest, not the newest',
    mergeRecent(['1', '2', '3'], 'new', 2).join(),
    'new,1',
);

done();
