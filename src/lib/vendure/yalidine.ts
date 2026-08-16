import {graphql} from '@/graphql';

/**
 * Temporary loose graphql helper until Shop API yalidine schema
 * is deployed and `graphql-env.d.ts` is regenerated.
 */
const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

export type YalidinePickupCenter = {
    centerId: number;
    name: string;
    address?: string | null;
    communeId?: number | null;
    communeName?: string | null;
    wilayaId: number;
    wilayaName: string;
};

export type YalidinePickupCentersResult = {
    centers: YalidinePickupCenter[];
    suggestedCenterId?: number | null;
    selectedCenterId?: number | null;
};

export type YalidineShippingQuoteOption = {
    code: string;
    price: number;
};

export type YalidineShippingQuoteResult = {
    available: boolean;
    wilayaName?: string | null;
    communeName?: string | null;
    source?: string | null;
    homeDelivery?: YalidineShippingQuoteOption | null;
    stopDesk?: YalidineShippingQuoteOption | null;
};

export const GetYalidinePickupCentersQuery = graphqlUnsafe(`
    query GetYalidinePickupCenters {
        yalidinePickupCenters {
            centers {
                centerId
                name
                address
                communeId
                communeName
                wilayaId
                wilayaName
            }
            suggestedCenterId
            selectedCenterId
        }
    }
`);

export const GetYalidineShippingQuoteQuery = graphqlUnsafe(`
    query GetYalidineShippingQuote($province: String!, $city: String!, $countryCode: String) {
        yalidineShippingQuote(province: $province, city: $city, countryCode: $countryCode) {
            available
            wilayaName
            communeName
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

export const SetYalidinePickupCenterMutation = graphqlUnsafe(`
    mutation SetYalidinePickupCenter($centerId: Int) {
        setYalidinePickupCenter(centerId: $centerId) {
            id
        }
    }
`);

export type YalidineShopHistoryItem = {
    tracking?: string | null;
    dateStatus?: string | null;
    status?: string | null;
    communeName?: string | null;
    wilayaName?: string | null;
    centerName?: string | null;
};

export type YalidineShopOrderTracking = {
    parcel?: {
        tracking?: string | null;
        labels?: string | null;
        lastStatus?: string | null;
        isStopdesk?: boolean | null;
        centerId?: number | null;
    } | null;
    history: YalidineShopHistoryItem[];
};

export const GetYalidineOrderTrackingQuery = graphqlUnsafe(`
    query GetYalidineOrderTracking($orderCode: String!) {
        yalidineOrderTracking(orderCode: $orderCode) {
            parcel {
                tracking
                labels
                lastStatus
                isStopdesk
                centerId
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

export const YALIDINE_HOME_METHOD_CODE = 'yalidine-home';
export const YALIDINE_STOPDESK_METHOD_CODE = 'yalidine-stopdesk';

export function isYalidineStopdeskMethod(code?: string | null): boolean {
    if (!code) return false;
    return code === YALIDINE_STOPDESK_METHOD_CODE;
}

export function isYalidineShippingMethod(code?: string | null): boolean {
    if (!code) return false;
    return (
        code === YALIDINE_HOME_METHOD_CODE ||
        code === YALIDINE_STOPDESK_METHOD_CODE ||
        code.startsWith('yalidine')
    );
}
