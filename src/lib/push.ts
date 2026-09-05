import {useEffect, useRef} from 'react';
import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import {router} from 'expo-router';
import {prefsStorage} from '@/lib/storage/mmkv';
import {resolveNotificationUrl} from '@/lib/notification-routes';
import {tr} from '@/features/catalogue-strings';

/**
 * Push notifications.
 *
 * Deliberately conservative about *when* permission is requested. iOS gives an
 * app exactly one chance to ask, and asking on first launch (before the user
 * knows what the app is) is how a store ends up permanently unable to tell
 * anyone their order shipped. So `registerForPush` is exported for a screen to
 * call after a meaningful moment — placing an order, or an explicit opt-in in
 * account settings — and nothing here asks on its own.
 *
 * The token is not sent anywhere yet: the Vendure backend has no device
 * registry. It is stored so that wiring can happen without another permission
 * prompt.
 */

const PUSH_TOKEN_KEY = 'expo_push_token';
const PUSH_DECLINED_KEY = 'push_declined';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
    }),
});

export function getStoredPushToken(): string | null {
    return prefsStorage().getString(PUSH_TOKEN_KEY) ?? null;
}

/** True once the user has said no; used to avoid nagging. */
export function hasDeclinedPush(): boolean {
    return prefsStorage().getBoolean(PUSH_DECLINED_KEY) ?? false;
}

/**
 * Ask for permission and obtain an Expo push token.
 *
 * Returns null when declined, on a simulator (which cannot receive push), or
 * when the project id is unavailable. Callers should treat null as "no push"
 * and carry on rather than surfacing an error: notifications are an
 * enhancement, not a requirement for buying anything.
 */
export async function registerForPush(): Promise<string | null> {
    // A simulator cannot receive push, and getExpoPushTokenAsync throws
    // there. Rather than add expo-device (a native module, so every
    // contributor would need a rebuild before the app would even start) for
    // one boolean, the token call below is allowed to fail and returns null.

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== 'granted') {
        if (!existing.canAskAgain) return null;
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
    }

    if (status !== 'granted') {
        prefsStorage().set(PUSH_DECLINED_KEY, true);
        return null;
    }

    if (Platform.OS === 'android') {
        // Android 8+ drops notifications posted to no channel.
        // The channel name is what Android shows in the app's notification
        // settings, so it is translated like any other label.
        await Notifications.setNotificationChannelAsync('orders', {
            name: tr('Account.notificationsTitle'),
            importance: Notifications.AndroidImportance.DEFAULT,
        });
    }

    try {
        const {data} = await Notifications.getExpoPushTokenAsync();
        prefsStorage().set(PUSH_TOKEN_KEY, data);
        return data;
    } catch {
        // A missing EAS project id throws here. Push simply stays off.
        return null;
    }
}

/**
 * Route a notification tap.
 *
 * The payload carries a `url` (an app path such as `/order/ABC123`) so the
 * backend can decide where a notification leads without an app release.
 *
 * That destination is untrusted input, and `router.push` to a path the app
 * does not serve silently does nothing, so the URL is validated against the
 * real route list first. A rejected payload still opens the app, it just does
 * not navigate, and says why in dev.
 */
function handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data;
    const url = resolveNotificationUrl(data);

    if (!url) {
        if (__DEV__ && data?.url) {
            console.warn('[push] ignoring unroutable notification url:', data.url);
        }
        return;
    }

    router.push(url as never);
}

/**
 * Wire notification taps, including the cold-start case.
 *
 * A tap that launches the app from terminated does *not* fire the response
 * listener, so the last response has to be read explicitly. Missing that is
 * why "the notification opens the app but not the order" is such a common bug.
 */
export function useNotificationRouting(): void {
    const handled = useRef(false);

    useEffect(() => {
        void (async () => {
            if (handled.current) return;
            handled.current = true;

            const last = await Notifications.getLastNotificationResponseAsync();
            if (last) handleNotificationResponse(last);
        })();

        const subscription = Notifications.addNotificationResponseReceivedListener(
            handleNotificationResponse,
        );
        return () => subscription.remove();
    }, []);
}
