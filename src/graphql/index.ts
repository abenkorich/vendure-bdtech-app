import {initGraphQLTada} from 'gql.tada';
import type {introspection} from './graphql-env.d.ts';

/**
 * Shared gql.tada instance. Identical scalar mapping to the web storefront so
 * the copied documents type-check the same way here.
 *
 * `Money` is an integer number of minor units (centimes for DZD). Never render
 * it directly; go through `formatPrice` in `lib/format.ts`.
 */
export const graphql = initGraphQLTada<{
    introspection: introspection;
    scalars: {
        DateTime: string;
        JSON: Record<string, unknown>;
        Money: number;
    };
}>();

export type {FragmentOf, ResultOf, VariablesOf} from 'gql.tada';
export {readFragment} from 'gql.tada';
