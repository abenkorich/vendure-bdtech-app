import type {MerchandisingSort} from '@/lib/vendure/merchandising';
import {getCurrentPage} from '@/lib/search-helpers';

const SORT_MAP: Record<string, MerchandisingSort> = {
    'name-asc': {name: 'ASC'},
    'name-desc': {name: 'DESC'},
    'price-asc': {price: 'ASC'},
    'price-desc': {price: 'DESC'},
    'arrival-desc': {arrivalDate: 'DESC'},
    'arrival-asc': {arrivalDate: 'ASC'},
};

export function buildMerchandisingOptions(input: {
    searchParams: {[key: string]: string | string[] | undefined};
    take?: number;
    /** Used when `sort` query param is absent. */
    defaultSort?: MerchandisingSort;
}) {
    const take = input.take ?? 12;
    const page = getCurrentPage(input.searchParams);
    const skip = (page - 1) * take;
    const sortKey = (input.searchParams.sort as string) || '';
    const sort = SORT_MAP[sortKey] ?? input.defaultSort ?? {name: 'ASC'};

    return {
        skip,
        take,
        sort,
        page,
    };
}
