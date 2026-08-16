import type {ResultOf} from '@/graphql';
import {readFragment} from '@/graphql';
import {ProductCardFragment, SearchOverlayFragment} from '@/lib/vendure/fragments';
import type {FragmentOf} from '@/graphql';
import {
    GetActiveOrderQuery,
    GetActiveOrderForCheckoutQuery,
    GetProductDetailQuery,
    GetCollectionProductsQuery,
    GetTopCollectionsQuery,
    GetCustomerAddressesQuery,
    GetActiveCustomerQuery,
    GetCustomerOrdersQuery,
    GetOrderDetailQuery,
    SearchProductsQuery,
} from '@/lib/vendure/queries';

/**
 * Shared types, all derived from the GraphQL documents.
 *
 * Nothing here re-declares a shape gql.tada already infers. That is not
 * stylistic: a hand-written mirror of a query result is exactly the kind of
 * thing that keeps compiling after the document changes, and then renders
 * `undefined` at runtime. `ResultOf` makes a document edit a type error at
 * every call site instead.
 *
 * Reminder that outlives any individual type below: every `Money` field is an
 * **integer number of minor units** (centimes; DZD has 2). Never render one
 * raw.
 */

// --- primitives ---------------------------------------------------------

/** Integer minor units. Format via `lib/format`, never interpolate directly. */
export type Money = number;

export type StockLevel = 'IN_STOCK' | 'OUT_OF_STOCK' | 'LOW_STOCK' | (string & {});

// --- catalogue ----------------------------------------------------------

/** The search-result shape every product grid, rail and carousel renders. */
export type ProductCardData = FragmentOf<typeof ProductCardFragment>;

/** Unmask a ProductCard fragment for rendering. */
export function readProductCard(card: ProductCardData): ResultOf<typeof ProductCardFragment> {
    return readFragment(ProductCardFragment, card);
}

export function readProductCards(
    cards: readonly ProductCardData[],
): readonly ResultOf<typeof ProductCardFragment>[] {
    return readFragment(ProductCardFragment, [...cards]);
}

/**
 * The overlay's own fragment. It spreads ProductCard but is a *distinct*
 * masked type, so an overlay result is not assignable to `ProductCardData`
 * and must be unmasked with `readSearchOverlayResult`.
 */
export type SearchOverlayResultData = FragmentOf<typeof SearchOverlayFragment>;

export function readSearchOverlayResults(
    items: readonly SearchOverlayResultData[],
): readonly ResultOf<typeof SearchOverlayFragment>[] {
    return readFragment(SearchOverlayFragment, [...items]);
}

export type SearchResponse = ResultOf<typeof SearchProductsQuery>['search'];
export type SearchFacetValue = SearchResponse['facetValues'][number];

export type ProductDetail = NonNullable<ResultOf<typeof GetProductDetailQuery>['product']>;
export type ProductVariant = ProductDetail['variants'][number];
export type ProductOptionGroup = ProductDetail['optionGroups'][number];
export type ProductAsset = ProductDetail['assets'][number];

export type CollectionDetail = NonNullable<
    ResultOf<typeof GetCollectionProductsQuery>['collection']
>;
export type CollectionBreadcrumb = CollectionDetail['breadcrumbs'][number];
export type CollectionTreeNode = ResultOf<typeof GetTopCollectionsQuery>['collections']['items'][number];

// --- cart / order -------------------------------------------------------

export type ActiveOrder = NonNullable<ResultOf<typeof GetActiveOrderQuery>['activeOrder']>;
export type ActiveOrderLine = ActiveOrder['lines'][number];

export type CheckoutOrder = NonNullable<
    ResultOf<typeof GetActiveOrderForCheckoutQuery>['activeOrder']
>;

export type CustomerOrderSummary = NonNullable<
    ResultOf<typeof GetCustomerOrdersQuery>['activeCustomer']
>['orders']['items'][number];

export type OrderDetail = NonNullable<ResultOf<typeof GetOrderDetailQuery>['orderByCode']>;

// --- customer -----------------------------------------------------------

export type ActiveCustomer = NonNullable<ResultOf<typeof GetActiveCustomerQuery>['activeCustomer']>;

/**
 * A saved address.
 *
 * `activeCustomer.addresses` is nullable in the schema (a guest session
 * resolves it to null), so the array is unwrapped with NonNullable before
 * indexing; otherwise the element type is the union, not the address.
 */
export type CustomerAddress = NonNullable<
    NonNullable<ResultOf<typeof GetCustomerAddressesQuery>['activeCustomer']>['addresses']
>[number];

// --- Vendure result-union helpers --------------------------------------

/**
 * Vendure returns errors as data, not as GraphQL errors: every mutation
 * resolves to a union of the success type and an `ErrorResult`. Forgetting to
 * branch on `__typename` is the classic Vendure bug — the call "succeeds" and
 * the UI shows an empty cart.
 */
export interface VendureErrorResult {
    __typename: string;
    errorCode: string;
    message: string;
}

export function isErrorResult(value: unknown): value is VendureErrorResult {
    return (
        typeof value === 'object' &&
        value !== null &&
        'errorCode' in value &&
        typeof (value as {errorCode: unknown}).errorCode === 'string'
    );
}

/** Thrown by mutation hooks when Vendure answers with an `ErrorResult`. */
export class VendureResultError extends Error {
    readonly errorCode: string;

    constructor(result: VendureErrorResult) {
        super(result.message);
        this.name = 'VendureResultError';
        this.errorCode = result.errorCode;
    }
}

/** Narrow a Vendure union result, throwing on the error branch. */
export function unwrapResult<T>(value: T): Exclude<T, VendureErrorResult> {
    if (isErrorResult(value)) throw new VendureResultError(value);
    return value as Exclude<T, VendureErrorResult>;
}
