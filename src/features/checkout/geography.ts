import {useQuery, type UseQueryResult} from '@tanstack/react-query';
import {graphql} from '@/graphql';
import {query} from '@/lib/vendure/api';
import {CATALOGUE_ROOT} from '@/lib/query-keys';

/**
 * Wilaya / commune data.
 *
 * In Algeria the address *is* the wilaya and the commune: a courier quote, the
 * choice between home delivery and a stop-desk, and whether the parcel is
 * deliverable at all are all decided from those two fields. Free-text entry
 * here is not a minor UX wrinkle, it is how a parcel ends up undeliverable —
 * "Alger" typed as "alger centre" does not match a Yalidine wilaya, and the
 * order silently gets no shipping method.
 *
 * So the two fields are pickers backed by the backend's own geography table,
 * which is the same table the courier plugins match against. The document lives
 * here rather than in `lib/vendure/queries.ts` because that file is kept
 * diffable against the web storefront, which reaches this data through its own
 * bundled JSON instead.
 *
 * `graphqlUnsafe` mirrors `lib/vendure/yalidine.ts`: `geographyCountry` is not
 * in the `graphql-env.d.ts` snapshot yet, so the typed builder would reject it.
 * Verified live: `geographyCountry(code: "DZ")` returns 58 provinces.
 */
const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

export interface GeographyCity {
    code: string;
    name: string;
}

export interface GeographyProvince {
    code: string;
    name: string;
    cities: GeographyCity[];
}

export const GetGeographyCountryQuery = graphqlUnsafe(`
    query GetGeographyCountry($code: String!) {
        geographyCountry(code: $code) {
            code
            name
            provinces {
                code
                name
                cities {
                    code
                    name
                }
            }
        }
    }
`);

interface GeographyCountryData {
    geographyCountry?: {
        code: string;
        name: string;
        provinces: GeographyProvince[];
    } | null;
}

/**
 * Provinces (wilayas) and their communes for a country.
 *
 * Public reference data that never changes between users, so it goes under the
 * catalogue root and is persisted with the rest of it: an address form that
 * cannot offer a wilaya list offline is an address form nobody can finish.
 */
export function useProvinces(countryCode: string): UseQueryResult<GeographyProvince[], Error> {
    return useQuery({
        queryKey: [CATALOGUE_ROOT, 'geography', countryCode] as const,
        enabled: Boolean(countryCode),
        // Wilaya boundaries are not a thing that moves during a session.
        staleTime: 24 * 60 * 60 * 1000,
        queryFn: async ({signal}) => {
            const {data} = await query(GetGeographyCountryQuery, {code: countryCode}, {signal});
            return (data as GeographyCountryData).geographyCountry?.provinces ?? [];
        },
    });
}

/** Communes of a province, by province *name* (what the address field holds). */
export function citiesOf(
    provinces: readonly GeographyProvince[],
    provinceName: string | null | undefined,
): GeographyCity[] {
    if (!provinceName) return [];
    const match = provinces.find(province => province.name === provinceName);
    return match?.cities ?? [];
}
