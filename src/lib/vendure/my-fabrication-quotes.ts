import {query} from '@/lib/vendure/api';
import {
    MyFabricationQuotesQuery,
    type FabricationQuoteListItem,
} from '@/lib/vendure/fabrication-quotes';

interface MyQuotesResult {
    myFabricationQuoteRequests: {
        items: FabricationQuoteListItem[];
        totalItems: number;
    };
}

/** RSC-safe fetch for the signed-in customer's fabrication quotes. */
export async function getMyFabricationQuotes(): Promise<FabricationQuoteListItem[]> {
    try {
        const result = await query<
            MyQuotesResult,
            {options: {take: number; sort: {createdAt: string}}}
        >(
            MyFabricationQuotesQuery,
            {
                options: {
                    take: 50,
                    sort: {createdAt: 'DESC'},
                },
            },
            {useAuthToken: true},
        );
        return result.data.myFabricationQuoteRequests?.items ?? [];
    } catch {
        return [];
    }
}
