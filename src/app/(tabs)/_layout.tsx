import {Tabs} from 'expo-router';
import {useUnistyles} from 'react-native-unistyles';

/**
 * Bottom tab navigation.
 *
 * Five tabs is the practical maximum before labels truncate. Cart is a tab
 * rather than a header icon because it is the most revisited screen in any
 * store, and burying it behind a header button costs conversions.
 *
 * Icons land with the design-system work; labels alone keep this navigable
 * in the meantime.
 */
export default function TabsLayout() {
    const {theme} = useUnistyles();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: theme.colors.brand,
                tabBarInactiveTintColor: theme.colors.textMuted,
                tabBarStyle: {
                    backgroundColor: theme.colors.surface,
                    borderTopColor: theme.colors.border,
                },
            }}>
            <Tabs.Screen name="index" options={{title: 'Home'}} />
            <Tabs.Screen name="shop" options={{title: 'Shop'}} />
            <Tabs.Screen name="search" options={{title: 'Search'}} />
            <Tabs.Screen name="cart" options={{title: 'Cart'}} />
            <Tabs.Screen name="account" options={{title: 'Account'}} />
        </Tabs>
    );
}
