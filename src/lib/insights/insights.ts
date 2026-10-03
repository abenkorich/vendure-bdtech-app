import {useEffect, useRef} from 'react';
import {AppState, Dimensions} from 'react-native';
import {usePathname} from 'expo-router';
import {getLocale} from '@/i18n';
import {prefsStorage} from '@/lib/storage/mmkv';
import {mutate, VendureApiError} from '@/lib/vendure/api';
import {TrackStorefrontActivityMutation} from '@/lib/vendure/storefront-insights';
import {appScreenUrl, createSearchReporter, randomId, type InsightsEvent} from './insights-core';

/**
 * Feeds the backend's Customer insights reports ("Online now", searches) from
 * the app, the way `<StorefrontInsights />` does on the website.
 *
 * Fire-and-forget: every failure is swallowed, so a slow or older backend can
 * never surface in the UI. A backend without the plugin answers with a
 * GraphQL error; after the first one the tracker stops for this launch rather
 * than sending a doomed request every 45 seconds.
 */

const VISITOR_KEY = 'insights.visitorId';
const HEARTBEAT_MS = 45_000;
/** Lets the new screen render before its page view goes out. */
const PAGE_VIEW_DELAY_MS = 800;

/** One per launch: the backend's equivalent of a browser tab. */
const launchId = randomId();
let disabled = false;

function visitorId(): string {
    try {
        const storage = prefsStorage();
        const existing = storage.getString(VISITOR_KEY);
        if (existing) return existing;
        const id = randomId();
        storage.set(VISITOR_KEY, id);
        return id;
    } catch {
        return launchId;
    }
}

export function sendInsightsEvent(event: InsightsEvent): void {
    if (disabled) return;
    const {width, height} = Dimensions.get('screen');
    mutate<{trackStorefrontActivity: boolean}, {input: Record<string, unknown>}>(
        TrackStorefrontActivityMutation,
        {
            input: {
                ...event,
                visitorId: visitorId(),
                tabId: launchId,
                languageCode: getLocale(),
                screen: `${Math.round(width)}x${Math.round(height)}`,
                ...(event.type === 'SEARCH' ? {searchSource: 'PAGE'} : {}),
            },
        },
        // The session, so a signed-in customer shows by name.
        {useAuthToken: true},
    ).catch((error: unknown) => {
        if (error instanceof VendureApiError) disabled = true;
    });
}

const searchReporter = createSearchReporter((term, resultCount) =>
    sendInsightsEvent({type: 'SEARCH', term, resultCount, url: appScreenUrl('/search')}),
);

/** Report a search the shopper saw results (or none) for; debounced. */
export function trackSearch(term: string, resultCount: number): void {
    searchReporter.report(term, resultCount);
}

/**
 * Screen views, a heartbeat while the app is in the foreground, and a leave
 * signal when it goes to the background. Mount once, in the root layout.
 */
export function useInsightsTracking(): void {
    const pathname = usePathname();
    const current = useRef(pathname);
    current.current = pathname;

    useEffect(() => {
        if (AppState.currentState !== 'active') return;
        const handle = setTimeout(
            () => sendInsightsEvent({type: 'PAGE_VIEW', url: appScreenUrl(pathname)}),
            PAGE_VIEW_DELAY_MS,
        );
        return () => clearTimeout(handle);
    }, [pathname]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (AppState.currentState === 'active') {
                sendInsightsEvent({type: 'HEARTBEAT', url: appScreenUrl(current.current)});
            }
        }, HEARTBEAT_MS);
        const subscription = AppState.addEventListener('change', status => {
            if (status === 'active') {
                // Back from the background is a new visit on the report's clock.
                sendInsightsEvent({type: 'PAGE_VIEW', url: appScreenUrl(current.current)});
            } else if (status === 'background') {
                sendInsightsEvent({type: 'LEAVE'});
            }
        });
        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, []);
}
