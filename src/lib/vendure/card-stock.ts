import {graphql} from '@/graphql';

/**
 * Stock counts for cards the search index cannot answer for.
 *
 * `SearchResult` carries `inStock` and nothing more, so every card drawn from
 * a search — collection listings, search results, the Explore feed — knows
 * only whether a product is buyable, not how many are left. The rails escape
 * this because they are built from `products`, which returns variants.
 *
 * Rather than change every one of those screens to a heavier query, this asks
 * for the counts of the products a screen has just shown, in one request.
 * Written for this app rather than copied: the web storefront gets the same
 * figures from its own extras layer.
 */
export const CardStockQuery = graphql(`
    query CardStock($options: ProductListOptions) {
        products(options: $options) {
            items {
                id
                variants {
                    id
                    stockLevel
                }
            }
        }
    }
`);
