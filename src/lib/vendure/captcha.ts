import {graphql} from '@/graphql';

/**
 * Copied from the web storefront's `src/lib/vendure/captcha.ts`, minus the
 * browser half. Kept diffable against it: the action codes are the backend's
 * and must agree on both front-ends.
 */

const graphqlUnsafe = graphql as unknown as (source: string) => ReturnType<typeof graphql>;

export const CaptchaConfigQuery = graphqlUnsafe(`
    query CaptchaConfig {
        captchaConfig {
            enabled
            siteKey
            provider
            actions
        }
    }
`);

export type CaptchaProvider = 'recaptcha_v3' | 'recaptcha_v2';

export type CaptchaAction =
    | 'login'
    | 'register'
    | 'password_reset'
    | 'blog_comment'
    | 'product_review'
    | 'newsletter'
    | 'stock_alert'
    | 'fabrication_quote'
    | 'shop_chat';

export interface CaptchaConfig {
    enabled: boolean;
    siteKey: string | null;
    provider: CaptchaProvider;
    actions: string[];
}

export const DISABLED_CAPTCHA_CONFIG: CaptchaConfig = {
    enabled: false,
    siteKey: null,
    provider: 'recaptcha_v3',
    actions: [],
};

export function isCaptchaRequired(config: CaptchaConfig | null, action: CaptchaAction): boolean {
    return Boolean(config?.enabled && config.siteKey && config.actions.includes(action));
}

/** Narrow an unknown payload, so a backend change cannot crash a form. */
export function parseCaptchaConfig(raw: unknown): CaptchaConfig {
    if (!raw || typeof raw !== 'object') return DISABLED_CAPTCHA_CONFIG;
    const value = raw as Partial<CaptchaConfig>;
    return {
        enabled: Boolean(value.enabled),
        siteKey: typeof value.siteKey === 'string' && value.siteKey.trim() ? value.siteKey : null,
        provider: value.provider === 'recaptcha_v2' ? 'recaptcha_v2' : 'recaptcha_v3',
        actions: Array.isArray(value.actions) ? value.actions.map(String) : [],
    };
}
