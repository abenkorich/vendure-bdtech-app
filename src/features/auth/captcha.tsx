import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';
import {WebView, type WebViewMessageEvent} from 'react-native-webview';
import {useQuery} from '@tanstack/react-query';
import {query} from '@/lib/vendure/api';
import {queryKeys} from '@/lib/query-keys';
import {env} from '@/lib/env';
import {tr} from '@/features/catalogue-strings';
import {
    CaptchaConfigQuery,
    DISABLED_CAPTCHA_CONFIG,
    isCaptchaRequired,
    parseCaptchaConfig,
    type CaptchaAction,
    type CaptchaConfig,
} from '@/lib/vendure/captcha';

/**
 * reCAPTCHA for a native app.
 *
 * The backend rejects login, registration and password reset without a
 * reCAPTCHA token (`x-captcha-token`). reCAPTCHA v3 is a browser product and
 * its keys are bound to a domain, so there is no way to mint that token from
 * React Native alone. The storefront serves a page that does it —
 * `GET /api/captcha-bridge` — and this drives that page inside a hidden web
 * view on the storefront's own origin, which is what satisfies the domain
 * check.
 *
 * The web view is one pixel and mounted only once a form asks for it: it costs
 * a ~300 KB script download, and a shopper who never signs in should not pay
 * for it. It then stays mounted, so a retry or a second form is instant.
 *
 * When the backend has captcha switched off, or off for a given action, this
 * resolves to `undefined` and callers simply send no header.
 */

const BRIDGE_PATH = '/api/captcha-bridge';
/** Long enough for a cold script fetch on a slow connection. */
const EXECUTE_TIMEOUT_MS = 20000;

export class CaptchaUnavailableError extends Error {
    constructor() {
        super(tr('Auth.captchaFailed'));
        this.name = 'CaptchaUnavailableError';
    }
}

interface Pending {
    resolve: (token: string) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

interface CaptchaApi {
    /** A token for `action`, or undefined when the backend does not want one. */
    execute: (action: CaptchaAction) => Promise<string | undefined>;
    config: CaptchaConfig;
}

const CaptchaContext = createContext<CaptchaApi | null>(null);

export function useCaptchaConfig() {
    return useQuery({
        queryKey: queryKeys.captchaConfig(),
        queryFn: async ({signal}) => {
            const {data} = await query(CaptchaConfigQuery, {}, {signal});
            return parseCaptchaConfig((data as {captchaConfig?: unknown}).captchaConfig);
        },
        // A merchant toggling captcha in the Admin is rare, and a stale answer
        // only costs one rejected submit, which the retry then fixes.
        staleTime: 30 * 60 * 1000,
    });
}

export function CaptchaProvider({children}: {children: React.ReactNode}) {
    const {data: config = DISABLED_CAPTCHA_CONFIG} = useCaptchaConfig();

    const webViewRef = useRef<WebView>(null);
    const pending = useRef(new Map<number, Pending>());
    const nextId = useRef(1);
    // Mounting is deferred until the first `execute`; see the note above.
    const [mounted, setMounted] = useState(false);

    const settle = useCallback((id: number, apply: (entry: Pending) => void) => {
        const entry = pending.current.get(id);
        if (!entry) return;
        clearTimeout(entry.timer);
        pending.current.delete(id);
        apply(entry);
    }, []);

    const onMessage = useCallback(
        (event: WebViewMessageEvent) => {
            let payload: {type?: string; id?: number; token?: string};
            try {
                payload = JSON.parse(event.nativeEvent.data) as typeof payload;
            } catch {
                return;
            }

            if (payload.type === 'token' && typeof payload.id === 'number' && payload.token) {
                const token = payload.token;
                settle(payload.id, entry => entry.resolve(token));
                return;
            }

            if (payload.type === 'error' && typeof payload.id === 'number') {
                settle(payload.id, entry => entry.reject(new CaptchaUnavailableError()));
                return;
            }

            // `disabled` means the storefront says there is nothing to solve.
            // Fail every waiter rather than hang; the caller then sends no
            // token and the backend decides.
            if (payload.type === 'disabled') {
                for (const id of [...pending.current.keys()]) {
                    settle(id, entry => entry.reject(new CaptchaUnavailableError()));
                }
            }
        },
        [settle],
    );

    /**
     * A bridge that will not load (not deployed yet, offline, an error page)
     * must fail the waiters now rather than after the timeout: twenty seconds
     * of a spinning sign-in button reads as the app being broken.
     */
    const failAll = useCallback(() => {
        for (const id of [...pending.current.keys()]) {
            settle(id, entry => entry.reject(new CaptchaUnavailableError()));
        }
    }, [settle]);

    const execute = useCallback(
        (action: CaptchaAction): Promise<string | undefined> => {
            if (!isCaptchaRequired(config, action)) return Promise.resolve(undefined);

            setMounted(true);

            const id = nextId.current;
            nextId.current += 1;

            return new Promise<string>((resolve, reject) => {
                const timer = setTimeout(() => {
                    pending.current.delete(id);
                    reject(new CaptchaUnavailableError());
                }, EXECUTE_TIMEOUT_MS);
                pending.current.set(id, {resolve, reject, timer});

                // Injected even if the page is still loading: the request is
                // retried below until the bridge answers or the timer fires.
                const ask = () => {
                    webViewRef.current?.injectJavaScript(
                        `window.__captcha && window.__captcha.execute(${id}, ${JSON.stringify(action)}); true;`,
                    );
                };
                ask();
                const retry = setInterval(() => {
                    if (!pending.current.has(id)) {
                        clearInterval(retry);
                        return;
                    }
                    ask();
                }, 1500);
                setTimeout(() => clearInterval(retry), EXECUTE_TIMEOUT_MS);
            });
        },
        [config],
    );

    const value = useMemo<CaptchaApi>(() => ({execute, config}), [execute, config]);

    return (
        <CaptchaContext.Provider value={value}>
            {children}
            {mounted ? (
                <View style={{position: 'absolute', width: 1, height: 1, opacity: 0}} pointerEvents="none">
                    <WebView
                        ref={webViewRef}
                        source={{uri: `${env.siteUrl.replace(/\/$/, '')}${BRIDGE_PATH}`}}
                        onMessage={onMessage}
                        onError={failAll}
                        onHttpError={failAll}
                        javaScriptEnabled
                        // https only: the bridge is the storefront's own
                        // origin, which is what the reCAPTCHA key is bound to.
                        originWhitelist={['https://*']}
                        // Nothing here is a navigation target; keep it inert.
                        setSupportMultipleWindows={false}
                    />
                </View>
            ) : null}
        </CaptchaContext.Provider>
    );
}

/**
 * The captcha runner. Outside a provider it resolves to `undefined`, so a
 * screen rendered in isolation (a test, the showcase) still works and the
 * backend remains the thing that decides.
 */
export function useCaptcha(): CaptchaApi {
    return (
        useContext(CaptchaContext) ?? {
            execute: () => Promise.resolve(undefined),
            config: DISABLED_CAPTCHA_CONFIG,
        }
    );
}
