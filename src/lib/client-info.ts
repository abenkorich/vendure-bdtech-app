import {Platform} from 'react-native';
import * as Application from 'expo-application';

/**
 * Sent on every Shop API call so the backend can tell app traffic from the
 * website: the Customer insights reports badge app visitors, searches and
 * activity, and show the app version instead of a browser. The web storefront
 * never sends these, so their absence means "website".
 */
export const CLIENT_HEADERS: Readonly<Record<string, string>> = Object.freeze({
    'x-client-platform': Platform.OS,
    ...(Application.nativeApplicationVersion
        ? {'x-client-version': Application.nativeApplicationVersion}
        : {}),
});
