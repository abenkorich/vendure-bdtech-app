/**
 * `SearchInput` construction, shared by the search and collection hooks.
 *
 * Pure and dependency-free on purpose: this is the shape every product grid in
 * the app asks the backend for, so it is the thing most worth exercising
 * against the live API — and a test cannot import anything that reaches React
 * Native. Keeping it out of the hook files is what makes that possible.
 */

export type SortKey = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';

export interface SearchParams {
    term?: string;
    collectionSlug?: string;
    take?: number;
    skip?: number;
    sort?: string;
    facetValueIds?: string[];
    inStock?: boolean;
}

const SORT_MAP: Record<string, {name?: 'ASC' | 'DESC'; price?: 'ASC' | 'DESC'}> = {
    'name-asc': {name: 'ASC'},
    'name-desc': {name: 'DESC'},
    'price-asc': {price: 'ASC'},
    'price-desc': {price: 'DESC'},
};

export interface SearchInput {
    term?: string;
    collectionSlug?: string;
    take: number;
    skip: number;
    groupByProduct: boolean;
    sort: {name?: 'ASC' | 'DESC'; price?: 'ASC' | 'DESC'};
    facetValueFilters?: Array<{and: string}>;
    inStock?: boolean;
}

/**
 * Absent keys rather than `undefined` values: Vendure rejects an explicit null
 * for several of these, and an undefined in the object would also change the
 * query key hash for what is logically the same request.
 */
export function buildSearchInput(params: SearchParams = {}): SearchInput {
    const {
        term,
        collectionSlug,
        take = 24,
        skip = 0,
        sort = 'name-asc',
        facetValueIds = [],
        inStock,
    } = params;

    return {
        ...(term ? {term} : {}),
        ...(collectionSlug ? {collectionSlug} : {}),
        take,
        skip,
        // Every grid in this app shows products, not variants; without this a
        // product with 6 variants occupies 6 cells.
        groupByProduct: true,
        sort: SORT_MAP[sort] ?? SORT_MAP['name-asc'],
        ...(facetValueIds.length > 0
            ? {facetValueFilters: facetValueIds.map(id => ({and: id}))}
            : {}),
        ...(inStock !== undefined ? {inStock} : {}),
    };
}

export function buildCollectionSearchInput(
    slug: string,
    params: SearchParams = {},
): SearchInput {
    return buildSearchInput({...params, collectionSlug: slug});
}
