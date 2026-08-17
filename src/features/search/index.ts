/**
 * Search feature barrel. The screen imports from here so a component can be
 * split or renamed without touching the route file.
 */

export {SearchField, type SearchFieldProps} from './SearchField';
export {SearchStart, type SearchStartProps} from './SearchStart';
export {ResultGrid, ResultGridSkeleton, type ResultGridProps} from './ResultGrid';
export {NoResults, type NoResultsProps} from './NoResults';
export {FilterBar, type FilterBarProps} from './FilterBar';
export {FilterSheet, type FilterSheetProps} from './FilterSheet';
export {Chip, type ChipProps} from './Chip';

export {
    EMPTY_FILTERS,
    activeFilterCount,
    hasActiveFilters,
    groupFacets,
    priceFilterOf,
    sortParam,
    suggestionsFor,
    toggleFacetValue,
    SORT_OPTIONS,
    SORT_MESSAGE_KEY,
    SUGGESTED_TERMS,
    type FilterState,
    type SortKey,
    type FacetGroup,
} from './filter-state';

export {useRecentSearches, mergeRecent} from './recent-searches';
export {useDebouncedValue} from './use-debounced-value';
export {useFilteredSearch, PAGE_SIZE, type SearchCard} from './use-filtered-search';
export {useTranslations} from './i18n';
