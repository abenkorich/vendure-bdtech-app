// Unistyles is configured in `index.js`, before expo-router's entry, because
// route modules can execute before this file's body runs. Do not move it here.
// BootSplash first: importing it holds the native splash before any route
// module can paint.
import {useEffect, useState} from 'react';
import {BootSplash} from '@/components/ui/BootSplash';
import {Stack} from 'expo-router';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {StatusBar} from 'expo-status-bar';
import {DataProvider} from '@/lib/data-provider';
import {useNotificationRouting} from '@/lib/push';
import {useCollections} from '@/features/collection/queries';

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
                <Boot />
            </DataProvider>
        </GestureHandlerRootView>
    );
}

/**
 * The boot overlay's readiness: the collection tree, which every home layout
 * needs and which the persisted cache answers instantly on a second launch.
 * Settled either way (data or error) counts, so an offline start still lets
 * the app through to its empty states rather than beating forever; a slow
 * network is cut off at `BOOT_TIMEOUT_MS` for the same reason.
 */
const BOOT_TIMEOUT_MS = 4000;

function Boot() {
    const collections = useCollections();
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setTimedOut(true), BOOT_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, []);

    return <BootSplash ready={!collections.isPending || timedOut} />;
}
