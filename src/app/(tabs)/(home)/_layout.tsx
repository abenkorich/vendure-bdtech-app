import {Stack} from 'expo-router';

/**
 * The home tab's own stack. Product and collection pages are shared routes
 * (`(home,shop,search,cart,account)/…`) so they push *inside* whichever tab
 * opened them: the tab bar stays on screen, and back returns to that tab.
 *
 * `initialRouteName` anchors a deep link that lands directly on a product,
 * so back has somewhere to go instead of exiting the app.
 */
export const unstable_settings = {
    initialRouteName: 'index',
};

export default function HomeStackLayout() {
    return <Stack screenOptions={{headerShown: false}} />;
}
