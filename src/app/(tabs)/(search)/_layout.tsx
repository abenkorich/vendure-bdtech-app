import {Stack} from 'expo-router';

/**
 * The search tab's own stack. Product and collection pages are shared routes
 * (`(home,shop,search,cart,account)/…`) so they push *inside* whichever tab
 * opened them: the tab bar stays on screen, and back returns to that tab.
 *
 * `initialRouteName` anchors a deep link that lands directly on a product,
 * so back has somewhere to go instead of exiting the app.
 */
export const unstable_settings = {
    initialRouteName: 'search',
};

export default function SearchStackLayout() {
    return <Stack screenOptions={{headerShown: false}} />;
}
