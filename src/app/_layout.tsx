import '@/design/unistyles';

import {Stack} from 'expo-router';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {QueryClientProvider} from '@tanstack/react-query';
import {StatusBar} from 'expo-status-bar';
import {queryClient} from '@/lib/query-client';

/**
 * Root layout.
 *
 * The Unistyles import must come first: it configures the themes, and any
 * component that renders before `StyleSheet.configure` has run gets no theme.
 */
export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{flex: 1}}>
            <QueryClientProvider client={queryClient}>
                <StatusBar style="auto" />
                <Stack screenOptions={{headerShown: false}}>
                    <Stack.Screen name="(tabs)" />
                </Stack>
            </QueryClientProvider>
        </GestureHandlerRootView>
    );
}
