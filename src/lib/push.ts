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
 * **`registerForPush` has no caller on purpose.** There was an opt-in card in
 * the account screen; it was removed because it could not succeed. Two things
 * are missing and both are outside this file: `app.config.ts` carries no EAS
 * project id, so `getExpoPushTokenAsync` throws on every real phone; and the
 * Vendure backend has no device registry and nothing that publishes on order
 * events, so even a valid token would have nothing to receive. A button that
 * asks for a permission it cannot use spends iOS's single prompt for nothing.
 *
 * Do not wire a caller back in until the backend can store a token and send to
 * it. When that day comes, ask after a meaningful moment — placing an order,
 * or an explicit opt-in in account settings — never on first launch, before
 * the customer knows what the app is.
 *
 * `useNotificationRouting` below is live regardless: it costs no permission and
 * handles a tap correctly the moment notifications do start arriving.
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
 * The three ways asking for push can end.
 *
 * They were one `null` before, and the screen had to tell the customer to go
 * to their device settings whichever it was — advice that is simply wrong for
 * someone who *granted* permission and then hit a build with no push
 * credentials. The reason travels with the result so the screen can say the
 * true thing.
 */
export type PushRegistration =
    | {status: 'granted'; token: string}
    | {status: 'denied'}
    /** Permission is fine; this build cannot mint a token. See `reason`. */
    | {status: 'unavailable'; reason: string};

/**
 * Ask for permission and obtain an Expo push token.
 *
 * Never throws: notifications are an enhancement, not a requirement for buying
 * anything, so every failure comes back as a value.
 */
export async function registerForPush(): Promise<PushRegistration> {
    // A simulator cannot receive push, and getExpoPushTokenAsync throws
    // there. Rather than add expo-device (a native module, so every
    // contributor would need a rebuild before the app would even start) for
    // one boolean, the token call below is allowed to fail and returns null.

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== 'granted') {
        if (!existing.canAskAgain) return {status: 'denied'};
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
    }

    if (status !== 'granted') {
        prefsStorage().set(PUSH_DECLINED_KEY, true);
        return {status: 'denied'};
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
        return {status: 'granted', token: data};
    } catch (error) {
        /**
         * Two things land here, and the message is the only way to tell them
         * apart on a device:
         *
         * - **No EAS project id.** `getExpoPushTokenAsync` needs one to
         *   address the token, and `app.config.ts` carries none, so this is
         *   what every real phone hits today. `eas init` writes
         *   `extra.eas.projectId` and it starts working.
         * - **A simulator**, which cannot receive push at all.
         *
         * Neither is the customer's fault and neither is fixable from device
         * settings, which is exactly what the screen used to tell them.
         */
        const reason = error instanceof Error ? error.message : String(error);
        if (__DEV__) console.warn('[push] no token:', reason);
        return {status: 'unavailable', reason};
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
