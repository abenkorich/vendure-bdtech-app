import {useEffect, useRef, useState, type ReactNode} from 'react';
import {QueryClientProvider,focusManager, onlineManager} from '@tanstack/react-query';
import {AppState, type AppStateStatus} from 'react-native';
import {queryClient} from '@/lib/query-client';
import {restorePersistedCache, startPersistingCache} from '@/lib/persist-query-cache';
import {startAuthCacheSync} from '@/lib/auth/auth-cache-sync';
import {getAuthToken} from '@/lib/auth/token-store';

/**
 * The single place the data layer is switched on.
 *
 * Wrap the app in this instead of a bare `QueryClientProvider`. Four things
 * have to happen before the first screen renders, and each has a failure mode
 * that is invisible rather than loud:
 *
 * 1. **Restore the persisted catalogue** — synchronously, before the first
 *    render, or the app shows skeletons for a beat and then swaps in cached
 *    content, which reads as a flash rather than as speed.
 * 2. **Start mirroring the cache to MMKV** — otherwise the restore in (1) is
 *    reading a file nothing ever writes, and the whole feature silently does
 *    nothing on the second launch.
 * 3. **Wire the auth listener** — so a sign-out drops the previous customer's
 *    cart and addresses from the cache rather than showing them to whoever
 *    signs in next.
 * 4. **Warm the token mirror** — `peekAuthToken()` is synchronous but returns
 *    null until the keychain has been read once.
 *
 * Because (1) must run before the first paint, the restore happens during
 * module-scope-equivalent lazy init (a `useState` initialiser), not in an
 * effect.
 */

let bootstrapped = false;

function bootstrapOnce(): void {
    if (bootstrapped) return;
    bootstrapped = true;
    restorePersistedCache(queryClient);
    void getAuthToken();
}

export function DataProvider({children}: {children: ReactNode}) {
    // A useState initialiser runs during the first render, before paint.
    useState(() => {
        bootstrapOnce();
        return null;
    });

    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        const stopPersisting = startPersistingCache(queryClient);
        const stopAuthSync = startAuthCacheSync();

        // React Query's default focus tracking is browser-shaped; on mobile,
        // "focus" is the app returning to the foreground. Without this a cart
        // opened, backgrounded for an hour and reopened shows the old total.
        const onAppStateChange = (status: AppStateStatus) => {
            focusManager.setFocused(status === 'active');
        };
        const subscription = AppState.addEventListener('change', onAppStateChange);

        return () => {
            stopPersisting();
            stopAuthSync();
            subscription.remove();
        };
    }, []);

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export {queryClient, onlineManager};
