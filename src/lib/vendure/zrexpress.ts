import {graphql} from '@/graphql';

/**
 * Temporary loose graphql helper until Shop API zrexpress schema
 * is deployed and `graphql-env.d.ts` is regenerated.
 */
const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

export type ZrexpressShippingQuoteOption = {
    code: string;
    price: number;
};

export type ZrexpressShippingQuoteResult = {
    available: boolean;
    wilayaName?: string | null;
    communeName?: string | null;
    hasStopDesk?: boolean | null;
    source?: string | null;
    homeDelivery?: ZrexpressShippingQuoteOption | null;
    stopDesk?: ZrexpressShippingQuoteOption | null;
};

export const GetZrexpressShippingQuoteQuery = graphqlUnsafe(`
    query GetZrexpressShippingQuote($province: String!, $city: String!, $countryCode: String) {
        zrexpressShippingQuote(province: $province, city: $city, countryCode: $countryCode) {
            available
            wilayaName
            communeName
            hasStopDesk
            source
            homeDelivery {
                code
                price
            }
            stopDesk {
                code
                price
            }
        }
    }
`);

export type ZrexpressShopHistoryItem = {
    tracking?: string | null;
    dateStatus?: string | null;
    status?: string | null;
    communeName?: string | null;
    wilayaName?: string | null;
    centerName?: string | null;
};

export type ZrexpressShopOrderTracking = {
    parcel?: {
        tracking?: string | null;
        labels?: string | null;
        lastStatus?: string | null;
        isStopdesk?: boolean | null;
    } | null;
    history: ZrexpressShopHistoryItem[];
};

export const GetZrexpressOrderTrackingQuery = graphqlUnsafe(`
    query GetZrexpressOrderTracking($orderCode: String!) {
        zrexpressOrderTracking(orderCode: $orderCode) {
            parcel {
                tracking
                labels
                lastStatus
                isStopdesk
            }
            history {
                tracking
                dateStatus
                status
                communeName
                wilayaName
                centerName
            }
        }
    }
`);

export const ZREXPRESS_HOME_METHOD_CODE = 'zrexpress-home';
export const ZREXPRESS_STOPDESK_METHOD_CODE = 'zrexpress-stopdesk';
export const ZREXPRESS_COD_METHOD_CODE = 'zrexpress-cod';

export function isZrexpressStopdeskMethod(code?: string | null): boolean {
    if (!code) return false;
    return code === ZREXPRESS_STOPDESK_METHOD_CODE;
}

export function isZrexpressShippingMethod(code?: string | null): boolean {
    if (!code) return false;
    return (
        code === ZREXPRESS_HOME_METHOD_CODE ||
        code === ZREXPRESS_STOPDESK_METHOD_CODE ||
        code.startsWith('zrexpress')
    );
}
