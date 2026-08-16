export interface SearchInputParams {
    term?: string;
    collectionSlug?: string;
    take: number;
    skip: number;
    groupByProduct: boolean;
    sort: { name?: 'ASC' | 'DESC'; price?: 'ASC' | 'DESC' };
    facetValueFilters?: Array<{ and: string }>;
    /** Vendure filters stock natively; `undefined` means "no stock filter". */
    inStock?: boolean;
}

interface BuildSearchInputOptions {
    searchParams: { [key: string]: string | string[] | undefined };
    collectionSlug?: string;
    take?: number;
}

/** Selected price window, in minor currency units. Either bound may be absent. */
export interface PriceFilter {
    min?: number;
    max?: number;
}

function firstParam(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads `minPrice`/`maxPrice` (minor units) from the URL.
 *
 * Returns `null` when neither is a usable number, which callers use as the
 * "skip price filtering entirely" signal. A reversed window (min > max) is
 * normalised rather than rejected so a mis-typed URL still renders.
 */
export function getPriceFilter(searchParams: {
    [key: string]: string | string[] | undefined;
}): PriceFilter | null {
    const parse = (raw: string | undefined): number | undefined => {
        if (raw === undefined || raw === '') return undefined;
        const parsed = Number(raw);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
    };

    const min = parse(firstParam(searchParams.minPrice));
    const max = parse(firstParam(searchParams.maxPrice));

    if (min === undefined && max === undefined) return null;
    if (min !== undefined && max !== undefined && min > max) return { min: max, max: min };
    return { min, max };
}

/**
 * Reads the `inStock` param. Only the literal strings `true`/`false` count, so
 * an absent or malformed value leaves stock unfiltered.
 */
export function getInStockFilter(searchParams: {
    [key: string]: string | string[] | undefined;
}): boolean | undefined {
    const raw = firstParam(searchParams.inStock);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return undefined;
}

export function buildSearchInput({ searchParams, collectionSlug, take = 12 }: BuildSearchInputOptions): SearchInputParams {
    const page = Number(searchParams.page) || 1;
    const skip = (page - 1) * take;
    const sort = (searchParams.sort as string) || 'name-asc';
    const searchTerm = searchParams.q as string;

    // Extract facet value IDs from search params
    const facetValueIds = searchParams.facets
        ? Array.isArray(searchParams.facets)
            ? searchParams.facets
            : [searchParams.facets]
        : [];

    // Map sort parameter to Vendure SearchResultSortParameter
    const sortMapping: Record<string, { name?: 'ASC' | 'DESC'; price?: 'ASC' | 'DESC' }> = {
        'name-asc': { name: 'ASC' },
        'name-desc': { name: 'DESC' },
        'price-asc': { price: 'ASC' },
        'price-desc': { price: 'DESC' },
    };

    const inStock = getInStockFilter(searchParams);

    return {
        ...(searchTerm && { term: searchTerm }),
        ...(collectionSlug && { collectionSlug }),
        take,
        skip,
        groupByProduct: true,
        sort: sortMapping[sort] || sortMapping['name-asc'],
        ...(facetValueIds.length > 0 && {
            facetValueFilters: facetValueIds.map(id => ({ and: id }))
        }),
        ...(inStock !== undefined && { inStock }),
    };
}

export function getCurrentPage(searchParams: { [key: string]: string | string[] | undefined }): number {
    return Number(searchParams.page) || 1;
}
