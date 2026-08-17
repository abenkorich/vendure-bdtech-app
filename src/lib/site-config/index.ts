import {useQuery, type UseQueryResult} from '@tanstack/react-query';
import {env} from '@/lib/env';
import {prefsStorage} from '@/lib/storage/mmkv';
import {useLocale} from '@/i18n';
import {parseSiteConfig, parseSiteConfigVerbose, type AppSiteConfig} from './schema';
import fallback from './fallback.json';

/**
 * Merchant-configured home screen content.
 *
 * The source of truth is the web storefront's customizer, served by
 * `GET /api/site-config?locale=xx`. Sharing it means a merchant edits their
 * hero slides and categories once and both front-ends update, rather than the
 * app growing a second customizer that immediately drifts.
 *
 * Three layers, in order of preference:
 *
 *  1. **Network** — the current published config.
 *  2. **MMKV** — the last config this device saw, so a returning user gets the
 *     right merchandising instantly and offline.
 *  3. **Bundled JSON** — a snapshot committed to the repo.
 *
 * The third layer is the point. Home is the first screen anyone sees, and it
 * must render a real storefront even when the config service is unreachable —
 * on a bad connection, or if the web host is down while Vendure is fine. The
 * catalogue comes from Vendure regardless; only merchandising is affected.
 */

const CACHE_KEY = 'site_config_v1';

/** Cached per locale: the same config resolves to different copy per language. */
function cacheKey(locale: string): string {
    return `${CACHE_KEY}_${locale}`;
}

interface CachedConfig {
    config: AppSiteConfig;
    /** Epoch ms. Without this the cache would look permanently fresh. */
    fetchedAt: number;
}

/**
 * Memoised per locale.
 *
 * TanStack Query calls `initialData` and `initialDataUpdatedAt` separately on
 * every mount, and each call would otherwise mean an MMKV read plus a full Zod
 * parse. `writeCache` invalidates the entry, so this never serves a value
 * older than the last write.
 */
const cacheMemo = new Map<string, CachedConfig | null>();

function readCache(locale: string): CachedConfig | null {
    const memo = cacheMemo.get(locale);
    if (memo !== undefined) return memo;

    const result = readCacheUncached(locale);
    cacheMemo.set(locale, result);
    return result;
}

function readCacheUncached(locale: string): CachedConfig | null {
    const raw = prefsStorage().getString(cacheKey(locale));
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as {config?: unknown; fetchedAt?: unknown};

        // A blob without a timestamp predates this format. Treating it as
        // epoch 0 rather than dropping it keeps the offline render, and the
        // age makes it instantly stale so it is replaced on the next launch.
        return {
            config: parseSiteConfig(parsed.config),
            fetchedAt: typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : 0,
        };
    } catch {
        // A corrupt blob is not worth reporting: it just means one refetch.
        return null;
    }
}

function writeCache(locale: string, config: AppSiteConfig): void {
    const entry: CachedConfig = {config, fetchedAt: Date.now()};
    cacheMemo.set(locale, entry);

    try {
        prefsStorage().set(cacheKey(locale), JSON.stringify(entry));
    } catch {
        // Storage full or unavailable. The config still works this session.
    }
}

/**
 * Where the config service lives.
 *
 * Derived from the site URL rather than configured separately, because the
 * customizer and the storefront are the same deployment. When this moves into
 * Vendure, only this function changes.
 */
function configUrl(locale: string): string {
    const base = env.siteUrl.replace(/\/$/, '');
    return `${base}/api/site-config?locale=${encodeURIComponent(locale)}`;
}

async function fetchSiteConfig(locale: string, signal?: AbortSignal): Promise<AppSiteConfig> {
    const response = await fetch(configUrl(locale), {signal});
    if (!response.ok) throw new Error(`site-config responded ${response.status}`);

    const body = (await response.json()) as {config?: unknown};
    const {config, ok, issues} = parseSiteConfigVerbose(body.config);

    // A config the app cannot parse is a real problem worth seeing in
    // development, even though it degrades silently for the user.
    if (!ok && __DEV__) {
        console.warn('[site-config] published config did not validate:', issues);
    }

    writeCache(locale, config);
    return config;
}

/** The bundled snapshot, parsed once. */
const BUNDLED = parseSiteConfig(fallback);

/**
 * Site config for the active locale.
 *
 * Never returns undefined and never surfaces an error state: callers get a
 * usable config immediately, from cache or the bundle, and it is replaced when
 * the network answers. A home screen that renders nothing because a config
 * request failed would be a worse bug than slightly stale merchandising.
 */
export function useSiteConfig(): UseQueryResult<AppSiteConfig, Error> & {
    config: AppSiteConfig;
} {
    const {locale} = useLocale();

    const query = useQuery({
        queryKey: ['site-config', locale],
        queryFn: ({signal}) => fetchSiteConfig(locale, signal),
        // Merchandising changes rarely, and a stale hero is harmless.
        staleTime: 15 * 60 * 1000,
        gcTime: 7 * 24 * 60 * 60 * 1000,
        initialData: () => readCache(locale)?.config,
        // Without this, `initialData` is treated as fetched *now*, so a cached
        // config would look fresh for the whole staleTime and the app would
        // never refetch on launch. A merchant's published change would then
        // take 15 minutes to appear, which reads as the customizer being
        // broken.
        initialDataUpdatedAt: () => readCache(locale)?.fetchedAt,
        retry: 1,
    });

    return {...query, config: query.data ?? BUNDLED};
}

export {BUNDLED as bundledSiteConfig};
export type {AppSiteConfig} from './schema';
