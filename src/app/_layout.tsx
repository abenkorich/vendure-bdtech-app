// Unistyles is configured in `index.js`, before expo-router's entry, because
// route modules can execute before this file's body runs. Do not move it here.
import {Stack} from 'expo-router';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {StatusBar} from 'expo-status-bar';
import {DataProvider} from '@/lib/data-provider';
import {useNotificationRouting} from '@/lib/push';

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
 */
export default function RootLayout() {
    // Route notification taps, including a cold start from a terminated app.
    useNotificationRouting();

    return (
        <GestureHandlerRootView style={{flex: 1}}>
            <DataProvider>
                <StatusBar style="auto" />
                <Stack screenOptions={{headerShown: false}}>
                    <Stack.Screen name="(tabs)" />
                </Stack>
            </DataProvider>
        </GestureHandlerRootView>
    );
}
