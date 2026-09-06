import {Tabs} from 'expo-router';
import type {ColorValue} from 'react-native';
import {useUnistyles} from 'react-native-unistyles';
import {IconSymbol, type IconName} from '@/components/ui';
import {useTranslations} from '@/i18n';

/**
 * Bottom tab navigation.
 *
 * Five tabs is the practical maximum before labels truncate. Cart is a tab
 * rather than a header icon because it is the most revisited screen in any
 * store, and burying it behind a header button costs conversions.
 *
 * Each tab uses its outline glyph when inactive and the filled one when
 * active. That reads as a state change at a glance, where a color shift alone
 * is easy to miss on a small, dark tab bar.
 *
 * Every tab is a group with its own stack (`(home)`, `(shop)`, …) rather than
 * a bare screen. Product and collection pages used to live in the root stack,
 * which covered the tab bar the moment a shopper opened anything; they are now
 * shared routes inside every tab group, so the bar is always present.
 */

function tabIcon(base: IconName, filled: IconName) {
    return function TabIcon({focused, color}: {focused: boolean; color: ColorValue}) {
        return <IconSymbol name={focused ? filled : base} size={24} color={String(color)} />;
    };
}

export default function TabsLayout() {
    const {theme} = useUnistyles();
    const t = useTranslations('Navigation');

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
            <Tabs.Screen
                name="(home)"
                options={{title: t('home'), tabBarIcon: tabIcon('home', 'homeFilled')}}
            />
            <Tabs.Screen
                name="(shop)"
                options={{title: t('shop'), tabBarIcon: tabIcon('shop', 'shopFilled')}}
            />
            <Tabs.Screen
                name="(search)"
                options={{title: t('search'), tabBarIcon: tabIcon('search', 'searchFilled')}}
            />
            <Tabs.Screen
                name="(cart)"
                options={{title: t('cart'), tabBarIcon: tabIcon('cart', 'cartFilled')}}
            />
            <Tabs.Screen
                name="(account)"
                options={{title: t('account'), tabBarIcon: tabIcon('account', 'accountFilled')}}
            />
        </Tabs>
    );
}
