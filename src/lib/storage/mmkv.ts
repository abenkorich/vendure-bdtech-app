import {createMMKV} from 'react-native-mmkv';
import type {MMKV} from 'react-native-mmkv';

/**
 * Device key/value storage.
 *
 * **MMKV is not encrypted.** Everything written here must be assumed readable
 * on a rooted or jailbroken device, which is why the auth token lives in
 * SecureStore (`lib/auth/token-store.ts`) and why the query persister
 * whitelists only catalogue data.
 *
 * Two instances rather than one so a cache wipe never takes user preferences
 * with it, and so a corrupt cache blob can be dropped in isolation.
 */

let cacheInstance: MMKV | undefined;
let prefsInstance: MMKV | undefined;

/** Public catalogue cache. Disposable: deleting it only costs a refetch. */
export function cacheStorage(): MMKV {
    cacheInstance ??= createMMKV({id: 'dzduino-query-cache'});
    return cacheInstance;
}

/** User preferences (locale, theme, recent searches). Not customer data. */
export function prefsStorage(): MMKV {
    prefsInstance ??= createMMKV({id: 'dzduino-prefs'});
    return prefsInstance;
}
