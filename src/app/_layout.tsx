// Unistyles is configured in `index.js`, before expo-router's entry, because
// route modules can execute before this file's body runs. Do not move it here.
import {Stack} from 'expo-router';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {StatusBar} from 'expo-status-bar';
import {DataProvider} from '@/lib/data-provider';
import {useNotificationRouting} from '@/lib/push';
import {CaptchaProvider} from '@/features/auth/captcha';

/**
 * Root layout.
 *
 * The Unistyles import must come first: it configures the themes, and any
 * component that renders before `StyleSheet.configure` has run gets no theme.
 *
 * `DataProvider` replaces a bare `QueryClientProvider`: besides supplying the
 * client it restores the persisted catalogue before the first paint, mirrors
 * it back to MMKV, and clears customer-scoped queries when the session
 * changes. See `lib/data-provider.tsx`.
 *
 * **Nothing holds the splash.** There was a branded overlay here that waited
 * for the collection tree and for a minimum of its own showing time. It read
 * as the app refusing to start: the content was ready behind it and the
 * shopper was made to watch a logo. The native splash now hands straight over
 * to the first screen, which renders its own skeletons while its data lands —
 * the same treatment every other screen gets, and visibly faster.
 */
export default function RootLayout() {
    // Route notification taps, including a cold start from a terminated app.
    useNotificationRouting();

    return (
        <GestureHandlerRootView style={{flex: 1}}>
            <DataProvider>
                {/* Above the router: the auth mutations reach for a captcha
                    token, and the hidden web view that mints one must outlive
                    the screen that asked. */}
                <CaptchaProvider>
                    <StatusBar style="auto" />
                    <Stack screenOptions={{headerShown: false}}>
                        <Stack.Screen name="(tabs)" />
                    </Stack>
                </CaptchaProvider>
            </DataProvider>
        </GestureHandlerRootView>
    );
}
