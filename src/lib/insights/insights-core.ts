/**
 * Pure half of the Customer insights tracker: no React Native, so it runs in
 * the Node test harness. The device half is `insights.ts`.
 */

export type InsightsEventType = 'PAGE_VIEW' | 'HEARTBEAT' | 'LEAVE' | 'SEARCH';

export interface InsightsEvent {
    type: InsightsEventType;
    url?: string;
    term?: string;
    resultCount?: number;
}

/**
 * An app screen as the reports show it. The `app://` scheme keeps it from
 * being mistaken for a website page: the admin links website pages and only
 * prints these. `new URL('app:///product/x').pathname` is `/product/x`, which
 * is what the report displays.
 */
export function appScreenUrl(pathname: string | null | undefined): string {
    const path = (pathname ?? '/').trim() || '/';
    return `app://${path.startsWith('/') ? path : `/${path}`}`.slice(0, 1024);
}

/** Random id for the visitor (stored once per install) and the launch. */
export function randomId(): string {
    const cryptoApi = (globalThis as {crypto?: {randomUUID?: () => string}}).crypto;
    if (cryptoApi?.randomUUID) {
        return cryptoApi.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Reports a search term only once the shopper has stopped typing for `delayMs`,
 * so "e", "es", "esp" do not each count as a search. A newer term cancels the
 * pending one.
 */
export function createSearchReporter(
    send: (term: string, resultCount: number) => void,
    delayMs = 1500,
): {report: (term: string, resultCount: number) => void; cancel: () => void} {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = undefined;
        }
    };
    return {
        report(term, resultCount) {
            cancel();
            const trimmed = term.trim();
            if (!trimmed) {
                return;
            }
            timer = setTimeout(() => {
                timer = undefined;
                send(trimmed, Math.max(0, Math.floor(resultCount)));
            }, delayMs);
        },
        cancel,
    };
}
