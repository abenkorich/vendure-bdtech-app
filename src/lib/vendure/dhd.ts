import {graphql} from '@/graphql';

/**
 * Temporary loose graphql helper until Shop API dhd schema
 * is deployed and `graphql-env.d.ts` is regenerated.
 */
const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

export type DhdPickupDesk = {
    deskId: number;
    name: string;
    address?: string | null;
    communeName?: string | null;
    wilayaId: number;
    wilayaName: string;
    phone?: string | null;
    mapUrl?: string | null;
};

export type DhdPickupDesksResult = {
    desks: DhdPickupDesk[];
    suggestedDeskId?: number | null;
    selectedDeskId?: number | null;
    /**
     * True when the rows are the cities DHD runs a stop desk in, rather than
     * named offices — this DHD account publishes no office list.
     */
    fromCommunes?: boolean | null;
};

export const GetDhdPickupDesksQuery = graphqlUnsafe(`
    query GetDhdPickupDesks {
        dhdPickupDesks {
            desks {
                deskId
                name
                address
                communeName
                wilayaId
                wilayaName
                phone
                mapUrl
            }
            suggestedDeskId
            selectedDeskId
            fromCommunes
        }
    }
`);

export const SetDhdPickupDeskMutation = graphqlUnsafe(`
    mutation SetDhdPickupDesk($deskId: Int) {
        setDhdPickupDesk(deskId: $deskId) {
            id
        }
    }
`);

export type DhdShippingQuoteOption = {
    code: string;
    price: number;
};

export type DhdShippingQuoteResult = {
    available: boolean;
    wilayaName?: string | null;
    communeName?: string | null;
    hasStopDesk?: boolean | null;
    source?: string | null;
    homeDelivery?: DhdShippingQuoteOption | null;
    stopDesk?: DhdShippingQuoteOption | null;
};

export const GetDhdShippingQuoteQuery = graphqlUnsafe(`
    query GetDhdShippingQuote($province: String!, $city: String!, $countryCode: String) {
        dhdShippingQuote(province: $province, city: $city, countryCode: $countryCode) {
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

export type DhdShopHistoryItem = {
    tracking?: string | null;
    dateStatus?: string | null;
    status?: string | null;
    communeName?: string | null;
    wilayaName?: string | null;
    centerName?: string | null;
};

export type DhdShopOrderTracking = {
    parcel?: {
        tracking?: string | null;
        labels?: string | null;
        lastStatus?: string | null;
        isStopdesk?: boolean | null;
        deskId?: number | null;
    } | null;
    history: DhdShopHistoryItem[];
};

export const GetDhdOrderTrackingQuery = graphqlUnsafe(`
    query GetDhdOrderTracking($orderCode: String!) {
        dhdOrderTracking(orderCode: $orderCode) {
            parcel {
                tracking
                labels
                lastStatus
                isStopdesk
                deskId
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

export const DHD_HOME_METHOD_CODE = 'dhd-home';
export const DHD_STOPDESK_METHOD_CODE = 'dhd-stopdesk';
export const DHD_COD_METHOD_CODE = 'dhd-cod';

export function isDhdStopdeskMethod(code?: string | null): boolean {
    if (!code) return false;
    return code === DHD_STOPDESK_METHOD_CODE;
}

export function isDhdShippingMethod(code?: string | null): boolean {
    if (!code) return false;
    return (
        code === DHD_HOME_METHOD_CODE ||
        code === DHD_STOPDESK_METHOD_CODE ||
        code.startsWith('dhd')
    );
}
