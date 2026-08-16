import * as SecureStore from 'expo-secure-store';

/**
 * Vendure session token storage.
 *
 * The token is a bearer credential for a logged-in customer, so it belongs in
 * the device keychain (iOS Keychain / Android Keystore) rather than MMKV or
 * AsyncStorage, both of which are readable on a rooted or jailbroken device.
 *
 * An in-memory mirror keeps reads synchronous-ish on the hot path: every
 * authenticated request would otherwise pay a native bridge round-trip.
 */

const TOKEN_KEY = 'vendure_auth_token';

let cachedToken: string | null | undefined;

/** Listeners for sign-in/sign-out, so the query cache can be reset. */
type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

export function onAuthTokenChange(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function emit(token: string | null): void {
    for (const listener of listeners) listener(token);
}

export async function getAuthToken(): Promise<string | null> {
    if (cachedToken !== undefined) return cachedToken;

    try {
        cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
        // A keychain read can fail on a locked device. Treating that as
        // "signed out" is safe: the worst case is one extra sign-in.
        cachedToken = null;
    }
    return cachedToken;
}

/** Synchronous read of the mirror. Null until `getAuthToken()` has run once. */
export function peekAuthToken(): string | null {
    return cachedToken ?? null;
}

export async function setAuthToken(token: string): Promise<void> {
    cachedToken = token;
    try {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch {
        // Keep the in-memory token so the current session still works even if
        // it cannot be persisted across launches.
    }
    emit(token);
}

export async function clearAuthToken(): Promise<void> {
    cachedToken = null;
    try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
        // Already gone, or the keychain is unavailable; the mirror is cleared
        // either way, which is what governs the current session.
    }
    emit(null);
}
