import Constants from 'expo-constants';

/**
 * Typed access to configuration.
 *
 * Values arrive via `app.config.ts` -> `expo.extra`, sourced from `EXPO_PUBLIC_*`
 * environment variables. Anything under that prefix is inlined into the JS
 * bundle at build time and is readable by anyone who unpacks the app, so no
 * secret may ever live here. Server-side secrets the web storefront holds
 * (`REVALIDATION_SECRET`, `OPENAI_API_KEY`, ...) deliberately have no mobile
 * equivalent.
 */

interface Extra {
    vendureShopApiUrl: string;
    vendureChannelToken: string;
    siteUrl: string;
}

function readExtra(): Extra {
    const extra = Constants.expoConfig?.extra as Partial<Extra> | undefined;

    // Failing loudly at startup beats every screen showing an empty state
    // because requests silently went nowhere.
    if (!extra?.vendureShopApiUrl) {
        throw new Error(
            'Missing vendureShopApiUrl. Copy .env.example to .env and restart the bundler ' +
                '(EXPO_PUBLIC_* values are read at build time, so a reload is not enough).',
        );
    }

    // The backend rejects the literal '__default_channel__' string, so there is
    // no safe default here: without a real token every request comes back
    // CHANNEL_NOT_FOUND and the whole app looks empty.
    if (!extra.vendureChannelToken) {
        throw new Error(
            'Missing vendureChannelToken. Set EXPO_PUBLIC_VENDURE_CHANNEL_TOKEN in .env ' +
                '(read it from `{ activeChannel { token } }`), then restart the bundler.',
        );
    }

    // The bare apex host serves Traefik's default self-signed certificate, so
    // every request to it fails TLS. That is invisible in the UI — images just
    // do not appear — and it survived a `.env` fix because `extra` is baked
    // into the native build, so only a rebuild picks the new value up. Refusing
    // to start says which of those two things is wrong.
    const siteUrl = extra.siteUrl ?? 'https://www.dzduino.dz';
    if (/^https:\/\/dzduino\.dz/.test(siteUrl)) {
        throw new Error(
            `siteUrl is ${siteUrl}, which serves a self-signed certificate: every ` +
                'customizer image will fail to load. Use https://www.dzduino.dz and ' +
                'rebuild the native app — extra is baked in at build time, so ' +
                'editing .env and reloading is not enough.',
        );
    }

    return {
        vendureShopApiUrl: extra.vendureShopApiUrl,
        vendureChannelToken: extra.vendureChannelToken,
        siteUrl,
    };
}

export const env = readExtra();
