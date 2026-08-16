import type {ExpoConfig} from 'expo/config';

/**
 * Bundle identifiers are reserved now so a later store submission never has to
 * rename the app (renaming after a build exists means new provisioning
 * profiles, a new Play listing, and losing any installed testers).
 */
const BUNDLE_ID = 'dz.dzduino.app';

const config: ExpoConfig = {
    name: 'Dzduino',
    slug: 'vendure-bdtech-app',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'dzduino',
    userInterfaceStyle: 'automatic',

    ios: {
        bundleIdentifier: BUNDLE_ID,
        supportsTablet: true,
        // The catalogue is served over https; no ATS exception needed.
    },

    android: {
        package: BUNDLE_ID,
        // Deep links: https://dzduino.dz/* opens in-app once the site hosts
        // assetlinks.json. Until then the scheme above is the working path.
        intentFilters: [
            {
                action: 'VIEW',
                autoVerify: true,
                data: [{scheme: 'https', host: 'dzduino.dz'}],
                category: ['BROWSABLE', 'DEFAULT'],
            },
        ],
    },

    plugins: [
        'expo-router',
        // Android 15 enforces edge-to-edge; opting in explicitly means the
        // insets are ours to manage rather than the system guessing.
        'react-native-edge-to-edge',
        'expo-localization',
        'expo-secure-store',
        'expo-notifications',
        [
            'expo-splash-screen',
            {
                backgroundColor: '#0B0F14',
                dark: {backgroundColor: '#0B0F14'},
                resizeMode: 'contain',
            },
        ],
    ],

    experiments: {
        typedRoutes: true,
    },

    extra: {
        // Read through `src/lib/env.ts`, never directly.
        vendureShopApiUrl:
            process.env.EXPO_PUBLIC_VENDURE_SHOP_API_URL ?? 'https://api.dzduino.dz/shop-api',
        // No fallback on purpose: the backend rejects '__default_channel__',
        // so a missing value must fail loudly in `lib/env.ts` rather than
        // producing CHANNEL_NOT_FOUND on every screen.
        vendureChannelToken: process.env.EXPO_PUBLIC_VENDURE_CHANNEL_TOKEN,
        siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? 'https://dzduino.dz',
    },
};

export default config;
