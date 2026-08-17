import {isYalidineStopdeskMethod} from '@/lib/vendure/yalidine';
import {isZrexpressStopdeskMethod} from '@/lib/vendure/zrexpress';

/**
 * Delivery method classification.
 *
 * The choice an Algerian customer actually makes is not "which of these six
 * carrier rows" — it is **stop-desk or to my door**, and then which carrier.
 * Stop-desk (pickup at the courier's agency) is typically 40% cheaper and is
 * what most orders use, so the two are presented as a segmented choice with the
 * carriers listed underneath, rather than as one flat list where the cheap
 * option is buried third.
 *
 * The stop-desk predicates are the copied ones from `lib/vendure/{yalidine,
 * zrexpress}.ts`; DHD's module ships no such helper, so its code is matched
 * here (verified live: the channel exposes `dhd-home` only, but the plugin
 * names a stop-desk variant the same way its siblings do).
 *
 * `in-store-pickup` is neither: it is collection from the shop itself, with no
 * courier and no fee, and folding it into "stop-desk" would tell a customer in
 * Oran to come to a counter in Algiers.
 */

export type DeliveryMode = 'stopdesk' | 'home' | 'pickup';

export interface DeliveryMethodLike {
    id: string;
    name: string;
    code: string;
    description?: string | null;
    priceWithTax: number;
}

const IN_STORE_PICKUP_CODE = 'in-store-pickup';

function isDhdStopdeskMethod(code: string): boolean {
    return code === 'dhd-stopdesk';
}

export function deliveryModeOf(code: string): DeliveryMode {
    if (code === IN_STORE_PICKUP_CODE) return 'pickup';
    if (
        isYalidineStopdeskMethod(code) ||
        isZrexpressStopdeskMethod(code) ||
        isDhdStopdeskMethod(code) ||
        code.endsWith('-stopdesk')
    ) {
        return 'stopdesk';
    }
    return 'home';
}

/**
 * Only Yalidine exposes a pickup-centre list on this backend
 * (`yalidinePickupCenters` / `setYalidinePickupCenter`). A ZR Express stop-desk
 * is chosen by the courier from the address, so asking the customer to pick a
 * centre we cannot persist would be a form that does nothing.
 */
export function requiresPickupCenter(code: string | null | undefined): boolean {
    return isYalidineStopdeskMethod(code);
}

export interface DeliveryGroup<T extends DeliveryMethodLike> {
    mode: DeliveryMode;
    methods: T[];
}

/**
 * Group methods by mode, cheapest first inside each group, in the order the
 * modes should be offered: stop-desk (cheapest, most used), home, then pickup.
 */
export function groupDeliveryMethods<T extends DeliveryMethodLike>(
    methods: readonly T[],
): DeliveryGroup<T>[] {
    const order: DeliveryMode[] = ['stopdesk', 'home', 'pickup'];

    return order
        .map(mode => ({
            mode,
            methods: methods
                .filter(method => deliveryModeOf(method.code) === mode)
                .sort((a, b) => a.priceWithTax - b.priceWithTax),
        }))
        .filter(group => group.methods.length > 0);
}

/**
 * Strip the HTML the backend stores in `description`.
 *
 * Method descriptions come from the admin UI's rich-text field and arrive as
 * `<p>Pickup from a Yalidine center</p>`. Rendering that raw puts literal tags
 * in front of the customer at the exact moment they are choosing how to
 * receive a parcel.
 */
export function plainDescription(html: string | null | undefined): string {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}
