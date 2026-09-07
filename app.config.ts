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
    icon: './assets/icon.png',

    ios: {
        bundleIdentifier: BUNDLE_ID,
        supportsTablet: true,
        // The catalogue is served over https; no ATS exception needed.
    },

    android: {
        package: BUNDLE_ID,
        // Android 13+ requires an explicit runtime permission to post any
        // notification. The expo-notifications plugin does not add it, and
        // without it requestPermissionsAsync silently resolves to "denied" on
        // a release build — while still appearing to work in dev, because the
        // emulator auto-grants it.
        permissions: ['android.permission.POST_NOTIFICATIONS'],
        adaptiveIcon: {
            foregroundImage: './assets/adaptive-icon.png',
            backgroundColor: '#0B0F14',
        },
        // Deep links: both hosts, because `dzduino.dz` currently redirects to
        // `www` and a link that lands on the redirect target must still open
        // in-app rather than bouncing to the browser.
        intentFilters: [
            {
                action: 'VIEW',
                autoVerify: true,
                data: [
                    {scheme: 'https', host: 'dzduino.dz'},
                    {scheme: 'https', host: 'www.dzduino.dz'},
                ],
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
                // An image is required: without one the Android build fails at
                // resource linking with "drawable/splashscreen_logo not found",
                // while iOS silently tolerates it.
                //
                // The wordmark, on the theme's own background colours, so the
                // JS boot overlay (`components/ui/BootSplash`) can take over
                // with the identical picture and start it beating without a
                // visible cut. Keep these colours equal to `tokens.ts`
                // background: white in light, slate950 in dark.
                image: './assets/splash-logo.png',
                imageWidth: 200,
                backgroundColor: '#ffffff',
                dark: {image: './assets/splash-logo.png', backgroundColor: '#020618'},
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
        // `www`, not the bare host: dzduino.dz serves Traefik's default
        // self-signed certificate, which fails TLS verification on both
        // platforms. Every customizer image resolves against this origin, so
        // the bare host would blank the hero and the category strip.
        siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? 'https://www.dzduino.dz',
    },
};

export default config;
