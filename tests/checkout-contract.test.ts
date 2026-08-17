import {print} from 'graphql';
import {GetActiveOrderForCheckoutQuery} from '@/lib/vendure/queries';
import {check, done} from './harness';

/**
 * The checkout document is the widest query in the app (addresses, shipping
 * lines, payment-relevant fields), so it is the most likely to reference a
 * field this backend does not expose. A failure here renders as a checkout
 * screen stuck on skeletons forever, with no error shown.
 */
const API = process.env.EXPO_PUBLIC_VENDURE_SHOP_API_URL ?? 'https://api.dzduino.dz/shop-api';
const TOKEN = process.env.EXPO_PUBLIC_VENDURE_CHANNEL_TOKEN ?? '';

export async function run(): Promise<void> {
    let response: Response;
    try {
        response = await fetch(API, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'vendure-token': TOKEN},
            body: JSON.stringify({query: print(GetActiveOrderForCheckoutQuery as never)}),
            signal: AbortSignal.timeout(15000),
        });
    } catch {
        console.log('        (skipped: Shop API unreachable)');
        return;
    }

    const result = (await response.json()) as {errors?: Array<{message: string}>};
    check(
        'the checkout order document validates against the live schema',
        !result.errors,
        JSON.stringify(result.errors?.slice(0, 3), null, 1),
    );
    done();
}
